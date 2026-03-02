const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Kolkata');
const patternService = require('./patternService');
const UserSettings = require('../models/UserSettings');

async function calculateRiskScore(userId, createdAt) {
  const flags = [];
  let scoreBreakdown = { limit: 0, gap: 0, trend: 0, peak: 0, behavior: 0 };

  const settings = await UserSettings.findOne({ userId });
  const dailyGoal = settings ? settings.dailyGoal : 5;

  // ── Gather all data ──
  const todayCount = await patternService.getTodayCount(userId);
  const peakHour = await patternService.getPeakHour(userId, 30, createdAt);
  const nowHour = moment().hour();
  const lastMinutes = await patternService.getLastCigaretteMinutesAgo(userId);
  const avgGap = await patternService.getAverageGap(userId);
  const rapidRepeat = await patternService.detectRapidRepeat(userId);
  const weightedTrend = await patternService.getWeightedTrend(userId, createdAt);
  const gapTrend = await patternService.getGapTrend(userId, createdAt);
  const triggerBreakdown = await patternService.getTodayTriggerBreakdown(userId);
  const consecutiveBreach = await patternService.getConsecutiveLimitBreachDays(userId, createdAt);
  const weeklyAvg = await patternService.getWeeklyAverage(userId, createdAt);

  // ═══════════════════════════════════════════
  // 1. LIMIT BREACH INTENSITY (max 30)
  //    Proportional: scales with how far over/under the goal
  // ═══════════════════════════════════════════
  if (dailyGoal > 0) {
    const ratio = todayCount / dailyGoal;
    scoreBreakdown.limit = Math.min(30, Math.round(ratio * 15));

    if (todayCount > dailyGoal) {
      const overBy = todayCount - dailyGoal;
      const severity = overBy >= 3 ? 'danger' : overBy >= 1 ? 'warning' : 'info';
      let text = `Limit cross! ${todayCount}/${dailyGoal} — ${overBy} extra pi li`;
      if (consecutiveBreach >= 2) {
        text += ` (${consecutiveBreach} din se lagatar over)`;
      }
      flags.push({
        text, severity, category: 'limit',
        trend: 'worsening', icon: 'exclamation-triangle-fill'
      });
    } else if (todayCount === dailyGoal) {
      flags.push({
        text: `Limit pe ho — ${todayCount}/${dailyGoal}, ab aur nahi`,
        severity: 'warning', category: 'limit',
        trend: 'stable', icon: 'exclamation-circle'
      });
    }
  }

  // ═══════════════════════════════════════════
  // 2. GAP DECAY (max 20)
  //    Compare last gap vs user's own average gap
  // ═══════════════════════════════════════════
  if (lastMinutes !== null && avgGap && avgGap > 0) {
    const gapRatio = lastMinutes / avgGap;
    // If last cig was much sooner than avg gap → high score
    if (gapRatio < 1) {
      scoreBreakdown.gap = Math.round(20 * (1 - gapRatio));
    }

    if (gapRatio < 0.5) {
      flags.push({
        text: `Gap bahut chhota — ${lastMinutes} min vs avg ${avgGap} min (${Math.round((1 - gapRatio) * 100)}% faster)`,
        severity: 'danger', category: 'gap',
        trend: 'worsening', icon: 'clock-history'
      });
    } else if (gapRatio < 0.75) {
      flags.push({
        text: `Gap shrink ho raha — ${lastMinutes} min vs avg ${avgGap} min`,
        severity: 'warning', category: 'gap',
        trend: 'worsening', icon: 'clock-history'
      });
    }
  } else if (lastMinutes !== null && lastMinutes < 30) {
    // Fallback for new users with no avg gap data
    scoreBreakdown.gap = 15;
    flags.push({
      text: `Sirf ${lastMinutes} min pehle pi thi — bohot jaldi`,
      severity: 'warning', category: 'gap',
      trend: 'worsening', icon: 'clock-history'
    });
  }

  // Gap trend over days (are gaps getting shorter?)
  if (gapTrend.currentAvgGap !== null && gapTrend.previousAvgGap !== null) {
    if (gapTrend.changePercent < -20) {
      flags.push({
        text: `Gap trend ↓ — avg ${gapTrend.previousAvgGap}→${gapTrend.currentAvgGap} min (${Math.abs(gapTrend.changePercent)}% tighter)`,
        severity: Math.abs(gapTrend.changePercent) > 30 ? 'danger' : 'warning',
        category: 'gap', trend: 'worsening', icon: 'arrow-down-circle'
      });
    } else if (gapTrend.changePercent > 20) {
      flags.push({
        text: `Gap badh raha ↑ — avg ${gapTrend.previousAvgGap}→${gapTrend.currentAvgGap} min (+${gapTrend.changePercent}% better)`,
        severity: 'info', category: 'gap',
        trend: 'improving', icon: 'arrow-up-circle'
      });
    }
  }

  // ═══════════════════════════════════════════
  // 3. TREND MOMENTUM (max 20)
  //    Weighted 7-day trend with actual % change
  // ═══════════════════════════════════════════
  if (weightedTrend.direction === 'worsening') {
    const intensity = Math.min(20, Math.round(Math.abs(weightedTrend.percentChange) * 0.4));
    scoreBreakdown.trend = intensity;
    flags.push({
      text: `Trend bigad raha ↗ — recent avg ${weightedTrend.recentAvg} vs pehle ${weightedTrend.olderAvg}/day (+${weightedTrend.percentChange}%)`,
      severity: weightedTrend.percentChange > 30 ? 'danger' : 'warning',
      category: 'trend', trend: 'worsening', icon: 'graph-up-arrow'
    });
  } else if (weightedTrend.direction === 'improving') {
    flags.push({
      text: `Trend improve ho raha ↘ — recent avg ${weightedTrend.recentAvg} vs pehle ${weightedTrend.olderAvg}/day (${weightedTrend.percentChange}%)`,
      severity: 'info', category: 'trend',
      trend: 'improving', icon: 'graph-down-arrow'
    });
  }

  // Extra: today vs weekly average
  if (todayCount > weeklyAvg && weeklyAvg > 0) {
    const overAvgPct = Math.round(((todayCount - weeklyAvg) / weeklyAvg) * 100);
    if (overAvgPct > 20) {
      scoreBreakdown.trend = Math.min(20, scoreBreakdown.trend + Math.round(overAvgPct * 0.15));
      flags.push({
        text: `Aaj weekly avg se ${overAvgPct}% zyada — ${todayCount} vs avg ${weeklyAvg.toFixed(1)}/day`,
        severity: overAvgPct > 50 ? 'danger' : 'warning',
        category: 'trend', trend: 'worsening', icon: 'bar-chart-line'
      });
    }
  }
  scoreBreakdown.trend = Math.min(20, scoreBreakdown.trend);

  // ═══════════════════════════════════════════
  // 4. PEAK HOUR PROXIMITY (max 15)
  //    Gradient scoring: closer = higher
  //    + weekend/weekday factor
  // ═══════════════════════════════════════════
  const hourDiff = Math.min(Math.abs(nowHour - peakHour), 24 - Math.abs(nowHour - peakHour));
  const isWeekend = [0, 6].includes(moment().day()); // 0=Sun, 6=Sat
  const weekendBoost = isWeekend ? 3 : 0; // weekends = higher risk typically

  if (hourDiff === 0) {
    scoreBreakdown.peak = Math.min(15, 15 + weekendBoost);
    flags.push({
      text: `Peak hour hai abhi — ${formatHour(peakHour)} pe sabse zyada peete ho${isWeekend ? ' (weekend!)' : ''}`,
      severity: 'warning', category: 'pattern',
      trend: 'stable', icon: 'alarm'
    });
  } else if (hourDiff === 1) {
    scoreBreakdown.peak = Math.min(15, 10 + weekendBoost);
    flags.push({
      text: `Peak hour (${formatHour(peakHour)}) ke paas ho — alert raho`,
      severity: 'info', category: 'pattern',
      trend: 'stable', icon: 'alarm'
    });
  } else if (hourDiff === 2) {
    scoreBreakdown.peak = Math.min(15, 5 + weekendBoost);
  } else if (weekendBoost > 0) {
    scoreBreakdown.peak = weekendBoost; // small boost even if far from peak on weekends
  }

  // ═══════════════════════════════════════════
  // 5. BEHAVIORAL PATTERNS (max 15)
  //    Rapid repeat + trigger intelligence
  // ═══════════════════════════════════════════
  if (rapidRepeat) {
    scoreBreakdown.behavior += 8;
    flags.push({
      text: 'Chain smoking alert — 60 min me 2 cigarettes!',
      severity: 'danger', category: 'behavior',
      trend: 'worsening', icon: 'lightning-charge'
    });
  }

  if (triggerBreakdown.dominant && triggerBreakdown.percentage >= 50 && triggerBreakdown.count >= 2) {
    scoreBreakdown.behavior += 7;
    flags.push({
      text: `"${triggerBreakdown.dominant}" ne ${triggerBreakdown.count}/${triggerBreakdown.total} baar trigger kiya aaj (${triggerBreakdown.percentage}%)`,
      severity: triggerBreakdown.percentage >= 70 ? 'danger' : 'warning',
      category: 'trigger', trend: 'worsening', icon: 'lightning'
    });
  }
  scoreBreakdown.behavior = Math.min(15, scoreBreakdown.behavior);

  // ═══════════════════════════════════════════
  // FINAL SCORE CALCULATION
  // ═══════════════════════════════════════════
  let score = scoreBreakdown.limit + scoreBreakdown.gap + scoreBreakdown.trend
    + scoreBreakdown.peak + scoreBreakdown.behavior;
  score = Math.min(score, 100);

  // 4-level risk
  let riskLevel = 'LOW';
  if (score >= 76) riskLevel = 'CRITICAL';
  else if (score >= 51) riskLevel = 'HIGH';
  else if (score >= 26) riskLevel = 'MODERATE';

  // Sort flags: danger first, then warning, then info
  const severityOrder = { danger: 0, warning: 1, info: 2 };
  flags.sort((a, b) => (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2));

  return {
    score,
    riskLevel,
    flags,
    scoreBreakdown,
    todayCount,
    peakHour,
    trend: weightedTrend.direction,
    consecutiveBreach,
    triggerBreakdown,
    gapTrend
  };
}

function formatHour(h) {
  const hr = h % 12 || 12;
  const suffix = h >= 12 ? 'PM' : 'AM';
  return hr + ' ' + suffix;
}

module.exports = { calculateRiskScore };
