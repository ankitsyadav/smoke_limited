const patternService = require('../services/patternService');
const financialService = require('../services/financialService');
const predictionService = require('../services/predictionService');
const UserSettings = require('../models/UserSettings');

exports.getAnalytics = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const createdAt = req.session.userCreatedAt;
    const earliest = await patternService.getEarliestLogDate(userId);
    const anchor = earliest || createdAt;
    const settings = await UserSettings.findOne({ userId });
    const daily7 = await patternService.getMovingAverage7Day(userId, anchor);
    const hourly = await patternService.getHourlyDistribution(userId, 9999, anchor);
    const financials = await financialService.getFinancials(userId, anchor);
    const triggerDist = await patternService.getTriggerDistribution(userId, 9999, anchor);
    const moodDist = await patternService.getMoodDistribution(userId, 9999, anchor);
    const weekly4 = await patternService.getWeeklyCounts(userId, 52, anchor);
    const dayOfWeek = await patternService.getDayOfWeekDistribution(userId, 9999, anchor);
    const weekdayHeatmap = await patternService.getWeekdayHourlyHeatmap(userId, anchor);
    const dailyGoal = settings ? settings.dailyGoal : 5;
    const costPerCig = settings ? settings.costPerCigarette : 15;
    const streak = await patternService.getStreakData(userId, anchor);
    const weeklyAvg = await patternService.getWeeklyAverage(userId, anchor);
    const avgGap = await patternService.getAverageGap(userId);
    const weightedTrend = await patternService.getWeightedTrend(userId, anchor);
    const gapTrend = await patternService.getGapTrend(userId, anchor);
    const triggerTimePatterns = await patternService.getTriggerTimeCorrelation(userId, anchor);

    // Compute summary insights server-side
    const dailyAll = await patternService.getDailyCounts(userId, 90, anchor);
    const bestDay = dailyAll.length > 0 ? dailyAll.reduce((a, b) => a.count <= b.count ? a : b) : null;
    const worstDay = dailyAll.length > 0 ? dailyAll.reduce((a, b) => a.count >= b.count ? a : b) : null;

    // Under-limit days %
    const underLimitDays = dailyAll.filter(d => d.count <= dailyGoal).length;
    const underLimitPct = dailyAll.length > 0 ? Math.round((underLimitDays / dailyAll.length) * 100) : 0;

    // Money saved from reduction (if improving)
    const recentAvg = weightedTrend.recentAvg || 0;
    const olderAvg = weightedTrend.olderAvg || 0;
    const dailySaved = olderAvg > recentAvg ? (olderAvg - recentAvg) * costPerCig : 0;

    res.render('analytics', {
      title: 'Analytics',
      daily7: JSON.stringify(daily7),
      hourly: JSON.stringify(hourly),
      financials,
      triggerDist: JSON.stringify(triggerDist),
      moodDist: JSON.stringify(moodDist),
      weekly4: JSON.stringify(weekly4),
      dayOfWeek: JSON.stringify(dayOfWeek),
      weekdayHeatmap: JSON.stringify(weekdayHeatmap),
      dailyGoal,
      costPerCig,
      streak,
      weeklyAvg: weeklyAvg.toFixed(1),
      avgGap,
      weightedTrend,
      gapTrend,
      triggerTimePatterns,
      bestDay,
      worstDay,
      underLimitPct,
      dailySaved: dailySaved.toFixed(0),
      totalLifetime: financials.lifetimeCigarettes
    });
  } catch (err) {
    next(err);
  }
};

exports.getAnalyticsData = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const fallback = req.session.userCreatedAt;
    const earliest = await patternService.getEarliestLogDate(userId);
    const anchor = earliest || fallback;
    const range = req.query.range || 'daily';
    let trendData;
    let hourlyDays;

    switch (range) {
      case 'daily':
        trendData = await patternService.getDailyCounts(userId, 90, anchor);
        hourlyDays = 90;
        break;
      case 'weekly':
        trendData = await patternService.getWeeklyCounts(userId, 52, anchor);
        hourlyDays = 365;
        break;
      case 'monthly':
        trendData = await patternService.getMonthlyCounts(userId, 12, anchor);
        hourlyDays = 365;
        break;
      case 'yearly':
        trendData = await patternService.getYearlyCounts(userId, 5, anchor);
        hourlyDays = 1825;
        break;
      default:
        trendData = await patternService.getDailyCounts(userId, 90, anchor);
        hourlyDays = 90;
    }

    const hourly = await patternService.getHourlyDistribution(userId, hourlyDays, anchor);
    const weekly4 = await patternService.getWeeklyCounts(userId, 52, anchor);
    res.json({ trendData, hourly, weekly4 });
  } catch (err) {
    next(err);
  }
};

// AI Analytics — return comprehensive data for Puter.js client-side AI
exports.getAnalyticsAI = async (req, res) => {
  try {
    const userId = req.session.userId;
    const createdAt = req.session.userCreatedAt;
    const earliest = await patternService.getEarliestLogDate(userId);
    const anchor = earliest || createdAt;
    const settings = await UserSettings.findOne({ userId });
    const dailyGoal = settings ? settings.dailyGoal : 5;
    const costPerCig = settings ? settings.costPerCigarette : 15;

    // Gather ALL available data for comprehensive behavior analysis
    const [
      todayCount, weeklyAvg, trend, peakHour, totalLifetime,
      dailySummary, triggerDist, moodDist, avgGap, hourlyDist,
      risk, streak, weightedTrend, gapTrend,
      consecutiveBreach, dayOfWeek, triggerTimePatterns,
      rapidRepeat, lastMinutes
    ] = await Promise.all([
      patternService.getTodayCount(userId),
      patternService.getWeeklyAverage(userId, anchor),
      patternService.getTrend(userId, anchor),
      patternService.getPeakHour(userId, 9999, anchor),
      patternService.getTotalLifetime(userId),
      patternService.getDailySummary(userId, 14, anchor),
      patternService.getTriggerDistribution(userId, 9999, anchor),
      patternService.getMoodDistribution(userId, 9999, anchor),
      patternService.getAverageGap(userId),
      patternService.getHourlyDistribution(userId, 9999, anchor),
      predictionService.calculateRiskScore(userId, createdAt),
      patternService.getStreakData(userId, anchor),
      patternService.getWeightedTrend(userId, anchor),
      patternService.getGapTrend(userId, anchor),
      patternService.getConsecutiveLimitBreachDays(userId, createdAt),
      patternService.getDayOfWeekDistribution(userId, 9999, anchor),
      patternService.getTriggerTimeCorrelation(userId, anchor),
      patternService.detectRapidRepeat(userId),
      patternService.getLastCigaretteMinutesAgo(userId)
    ]);

    // Process trigger + mood data
    const topTriggers = Object.entries(triggerDist).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}(${v})`).join(', ');
    const topMoods = Object.entries(moodDist).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}(${v})`).join(', ');

    // Hourly breakdown — only hours with count > 0
    const hourlyBreakdown = hourlyDist
      .map((count, hour) => count > 0 ? `${hour}:00=${count}` : null)
      .filter(Boolean)
      .join(', ');

    // Day-of-week summary
    const dowSummary = dayOfWeek.map(d => `${d.day}:${d.avg}`).join(', ');

    // Trigger-time patterns summary
    let triggerTimeSummary = '';
    if (triggerTimePatterns && triggerTimePatterns.length > 0) {
      triggerTimeSummary = triggerTimePatterns
        .slice(0, 5)
        .map(tp => `${tp.trigger}@${tp.hour}:00(${tp.count})`)
        .join(', ');
    }

    // Risk flags summary
    const flagsSummary = risk.flags
      .slice(0, 6)
      .map(f => `[${f.severity}] ${f.text}`)
      .join(' | ');

    res.json({
      // Core metrics
      todayCount, dailyGoal, weeklyAvg, trend, peakHour,
      totalLifetime, avgGap, costPerCig,
      // Daily data (14 days)
      dailySummary,
      // Distributions
      topTriggers: topTriggers || 'none',
      topMoods: topMoods || 'none',
      hourlyBreakdown: hourlyBreakdown || null,
      dowSummary,
      // Trends
      weightedTrend: {
        direction: weightedTrend.direction,
        percentChange: weightedTrend.percentChange,
        recentAvg: weightedTrend.recentAvg,
        olderAvg: weightedTrend.olderAvg
      },
      gapTrend: {
        currentAvgGap: gapTrend.currentAvgGap,
        previousAvgGap: gapTrend.previousAvgGap,
        changePercent: gapTrend.changePercent
      },
      // Risk + behavior
      riskScore: risk.score,
      riskLevel: risk.riskLevel,
      flagsSummary,
      scoreBreakdown: risk.scoreBreakdown,
      // Streak + patterns
      streak: { current: streak.currentStreak, best: streak.bestStreak },
      consecutiveBreach,
      rapidRepeat: !!rapidRepeat,
      lastMinutesAgo: lastMinutes,
      triggerTimeSummary: triggerTimeSummary || null
    });
  } catch (err) {
    console.error('[AnalyticsAI]', err);
    res.status(500).json({ insight: 'Error loading analytics data.' });
  }
};
