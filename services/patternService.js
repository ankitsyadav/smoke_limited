const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Kolkata');
const SmokeLog = require('../models/SmokeLog');

// Get earliest smoke log date for a user (the real "start" of their data)
async function getEarliestLogDate(userId) {
  const earliest = await SmokeLog.findOne({ userId }).sort({ timestamp: 1 }).select('timestamp').lean();
  return earliest ? earliest.timestamp : null;
}

// Clamp a start date so it's never before the anchor date
function clampStart(date, anchor) {
  if (!anchor) return date;
  const ca = new Date(anchor);
  return date < ca ? ca : date;
}

// How many days since the anchor date (min 1)
function daysSinceAnchor(anchor) {
  if (!anchor) return 30;
  const days = moment().diff(moment(anchor), 'days') + 1;
  return Math.max(days, 1);
}

async function getHourlyDistribution(userId, days = 30, createdAt) {
  const maxDays = Math.min(days, daysSinceAnchor(createdAt));
  const since = clampStart(moment().subtract(maxDays, 'days').startOf('day').toDate(), createdAt);
  const logs = await SmokeLog.find({ userId, timestamp: { $gte: since } });
  const buckets = Array(24).fill(0);
  logs.forEach(log => {
    const hour = moment(log.timestamp).hour();
    buckets[hour]++;
  });
  return buckets;
}

async function getPeakHour(userId, days = 30, createdAt) {
  const buckets = await getHourlyDistribution(userId, days, createdAt);
  let maxIdx = 0;
  buckets.forEach((count, idx) => {
    if (count > buckets[maxIdx]) maxIdx = idx;
  });
  return maxIdx;
}

async function getMovingAverage7Day(userId, createdAt) {
  const maxDays = Math.min(90, daysSinceAnchor(createdAt));
  const results = [];
  for (let i = maxDays - 1; i >= 0; i--) {
    const dayStart = moment().subtract(i, 'days').startOf('day').toDate();
    const dayEnd = moment().subtract(i, 'days').endOf('day').toDate();
    const clamped = clampStart(dayStart, createdAt);
    if (clamped > dayEnd) continue;
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: clamped, $lte: dayEnd } });
    results.push({ date: moment().subtract(i, 'days').format('MMM DD'), count });
  }
  return results;
}

async function getTrend(userId, createdAt) {
  const daysAvail = daysSinceAnchor(createdAt);
  if (daysAvail < 2) return 'stable';
  const last3 = [];
  const prev3 = [];
  const lastN = Math.min(3, daysAvail);
  for (let i = 0; i < lastN; i++) {
    const dayStart = clampStart(moment().subtract(i, 'days').startOf('day').toDate(), createdAt);
    const dayEnd = moment().subtract(i, 'days').endOf('day').toDate();
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: dayStart, $lte: dayEnd } });
    last3.push(count);
  }
  const prevN = Math.min(3, Math.max(0, daysAvail - lastN));
  for (let i = lastN; i < lastN + prevN; i++) {
    const dayStart = clampStart(moment().subtract(i, 'days').startOf('day').toDate(), createdAt);
    const dayEnd = moment().subtract(i, 'days').endOf('day').toDate();
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: dayStart, $lte: dayEnd } });
    prev3.push(count);
  }
  if (prev3.length === 0) return 'stable';
  const avgLast = last3.reduce((a, b) => a + b, 0) / last3.length;
  const avgPrev = prev3.reduce((a, b) => a + b, 0) / prev3.length;
  if (avgLast > avgPrev) return 'worsening';
  if (avgLast < avgPrev) return 'improving';
  return 'stable';
}

async function getTodayCount(userId) {
  const start = moment().startOf('day').toDate();
  const end = moment().endOf('day').toDate();
  return SmokeLog.countDocuments({ userId, timestamp: { $gte: start, $lte: end } });
}

async function getWeeklyAverage(userId, createdAt) {
  const daysAvail = Math.min(7, daysSinceAnchor(createdAt));
  const start = clampStart(moment().subtract(daysAvail, 'days').startOf('day').toDate(), createdAt);
  const total = await SmokeLog.countDocuments({ userId, timestamp: { $gte: start } });
  return total / daysAvail;
}

async function getAverageGap(userId) {
  const logs = await SmokeLog.find({ userId }).sort({ timestamp: -1 }).limit(20);
  if (logs.length < 2) return null;
  let totalGap = 0;
  for (let i = 0; i < logs.length - 1; i++) {
    totalGap += moment(logs[i].timestamp).diff(moment(logs[i + 1].timestamp), 'minutes');
  }
  return Math.round(totalGap / (logs.length - 1));
}

async function detectRapidRepeat(userId) {
  const logs = await SmokeLog.find({ userId }).sort({ timestamp: -1 }).limit(2);
  if (logs.length < 2) return false;
  const diff = moment(logs[0].timestamp).diff(moment(logs[1].timestamp), 'minutes');
  return diff <= 60;
}

async function getLastCigaretteMinutesAgo(userId) {
  const last = await SmokeLog.findOne({ userId }).sort({ timestamp: -1 });
  if (!last) return null;
  return moment().diff(moment(last.timestamp), 'minutes');
}

async function getTotalLifetime(userId) {
  return SmokeLog.countDocuments({ userId });
}

async function getDailyCounts(userId, days = 30, createdAt) {
  const maxDays = Math.min(days, daysSinceAnchor(createdAt));
  const results = [];
  for (let i = maxDays - 1; i >= 0; i--) {
    const dayStart = moment().subtract(i, 'days').startOf('day').toDate();
    const dayEnd = moment().subtract(i, 'days').endOf('day').toDate();
    const clamped = clampStart(dayStart, createdAt);
    if (clamped > dayEnd) continue;
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: clamped, $lte: dayEnd } });
    results.push({ date: moment().subtract(i, 'days').format('MMM DD'), count });
  }
  return results;
}

async function getWeeklyCounts(userId, weeks = 12, createdAt) {
  const results = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = moment().subtract(i, 'weeks').startOf('isoWeek').toDate();
    const weekEnd = moment().subtract(i, 'weeks').endOf('isoWeek').toDate();
    const clamped = clampStart(weekStart, createdAt);
    if (clamped > weekEnd) continue;
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: clamped, $lte: weekEnd } });
    results.push({ date: 'W' + moment().subtract(i, 'weeks').isoWeek() + ' ' + moment().subtract(i, 'weeks').format('MMM'), count });
  }
  return results;
}

async function getMonthlyCounts(userId, months = 12, createdAt) {
  const results = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = moment().subtract(i, 'months').startOf('month').toDate();
    const monthEnd = moment().subtract(i, 'months').endOf('month').toDate();
    const clamped = clampStart(monthStart, createdAt);
    if (clamped > monthEnd) continue;
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: clamped, $lte: monthEnd } });
    results.push({ date: moment().subtract(i, 'months').format('MMM YY'), count });
  }
  return results;
}

async function getYearlyCounts(userId, years = 5, createdAt) {
  const results = [];
  for (let i = years - 1; i >= 0; i--) {
    const yearStart = moment().subtract(i, 'years').startOf('year').toDate();
    const yearEnd = moment().subtract(i, 'years').endOf('year').toDate();
    const clamped = clampStart(yearStart, createdAt);
    if (clamped > yearEnd) continue;
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: clamped, $lte: yearEnd } });
    results.push({ date: moment().subtract(i, 'years').format('YYYY'), count });
  }
  return results;
}

// ── Today's timeline ──
async function getTodayTimeline(userId) {
  const start = moment().startOf('day').toDate();
  const end = moment().endOf('day').toDate();
  const logs = await SmokeLog.find({ userId, timestamp: { $gte: start, $lte: end } }).sort({ timestamp: 1 });
  return logs.map(l => ({
    time: moment(l.timestamp).format('h:mm A'),
    trigger: l.trigger || '',
    mood: l.mood || '',
    note: l.note || ''
  }));
}

// ── Trigger distribution ──
async function getTriggerDistribution(userId, days = 30, createdAt) {
  const maxDays = Math.min(days, daysSinceAnchor(createdAt));
  const since = clampStart(moment().subtract(maxDays, 'days').startOf('day').toDate(), createdAt);
  const logs = await SmokeLog.find({ userId, timestamp: { $gte: since }, trigger: { $ne: '' } });
  const dist = {};
  logs.forEach(l => {
    dist[l.trigger] = (dist[l.trigger] || 0) + 1;
  });
  return dist;
}

// ── Mood distribution ──
async function getMoodDistribution(userId, days = 30, createdAt) {
  const maxDays = Math.min(days, daysSinceAnchor(createdAt));
  const since = clampStart(moment().subtract(maxDays, 'days').startOf('day').toDate(), createdAt);
  const logs = await SmokeLog.find({ userId, timestamp: { $gte: since }, mood: { $ne: '' } });
  const dist = {};
  logs.forEach(l => {
    dist[l.mood] = (dist[l.mood] || 0) + 1;
  });
  return dist;
}

// ── Streak tracking ──
async function getStreakData(userId, createdAt) {
  const settings = (await require('../models/UserSettings').findOne({ userId })) || { dailyGoal: 5 };
  const goal = settings.dailyGoal;

  const daysAvail = daysSinceAnchor(createdAt);

  // Current streak: consecutive days at/under daily goal
  let currentStreak = 0;
  for (let i = 0; i < Math.min(365, daysAvail); i++) {
    const dayStart = moment().subtract(i, 'days').startOf('day').toDate();
    const dayEnd = moment().subtract(i, 'days').endOf('day').toDate();
    const clamped = clampStart(dayStart, createdAt);
    if (clamped > dayEnd) break;
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: clamped, $lte: dayEnd } });
    if (count <= goal && (i === 0 || count > 0 || currentStreak > 0)) {
      if (count <= goal) currentStreak++;
      else break;
    } else {
      break;
    }
  }

  // Best day (lowest count since account creation, max 30 days)
  let bestDay = { date: '--', count: Infinity };
  for (let i = 0; i < Math.min(30, daysAvail); i++) {
    const dayStart = moment().subtract(i, 'days').startOf('day').toDate();
    const dayEnd = moment().subtract(i, 'days').endOf('day').toDate();
    const clamped = clampStart(dayStart, createdAt);
    if (clamped > dayEnd) break;
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: clamped, $lte: dayEnd } });
    if (count < bestDay.count) {
      bestDay = { date: moment().subtract(i, 'days').format('MMM DD'), count };
    }
  }

  // Today vs yesterday
  const todayCount = await getTodayCount(userId);
  const yStart = moment().subtract(1, 'day').startOf('day').toDate();
  const yEnd = moment().subtract(1, 'day').endOf('day').toDate();
  const yesterdayCount = await SmokeLog.countDocuments({ userId, timestamp: { $gte: yStart, $lte: yEnd } });

  // Time since last cigarette
  const lastMinutes = await getLastCigaretteMinutesAgo(userId);

  return {
    daysSinceStart: daysAvail,
    currentStreak,
    bestDay,
    todayCount,
    yesterdayCount,
    comparison: todayCount < yesterdayCount ? 'better' : todayCount > yesterdayCount ? 'worse' : 'same',
    lastMinutesAgo: lastMinutes
  };
}

// ── Today's summary string for analytics AI ──
async function getDailySummary(userId, days = 7, createdAt) {
  const counts = await getDailyCounts(userId, days, createdAt);
  return counts.map(d => `${d.date}: ${d.count}`).join(', ');
}

// ── Day of Week distribution ──
async function getDayOfWeekDistribution(userId, days = 30, createdAt) {
  const maxDays = Math.min(days, daysSinceAnchor(createdAt));
  const since = clampStart(moment().subtract(maxDays, 'days').startOf('day').toDate(), createdAt);
  const logs = await SmokeLog.find({ userId, timestamp: { $gte: since } });
  // 0=Mon, 1=Tue, ... 6=Sun (isoWeekday: 1=Mon to 7=Sun)
  const buckets = Array(7).fill(0);
  const dayCounts = Array(7).fill(0); // count of each weekday in the range
  for (let i = 0; i < maxDays; i++) {
    const d = moment().subtract(i, 'days');
    const wd = d.isoWeekday() - 1; // 0=Mon ... 6=Sun
    dayCounts[wd]++;
  }
  logs.forEach(log => {
    const wd = moment(log.timestamp).isoWeekday() - 1;
    buckets[wd]++;
  });
  // Return average per day-of-week for fair comparison
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((lbl, i) => ({
    day: lbl,
    total: buckets[i],
    avg: dayCounts[i] > 0 ? parseFloat((buckets[i] / dayCounts[i]).toFixed(1)) : 0
  }));
}

// ── Gap Trend: compare avg gap of last 3 days vs previous 3 days ──
async function getGapTrend(userId, createdAt) {
  const daysAvail = daysSinceAnchor(createdAt);
  if (daysAvail < 2) return { currentAvgGap: null, previousAvgGap: null, changePercent: 0 };

  async function avgGapForDayRange(startDay, endDay) {
    const gaps = [];
    for (let i = startDay; i < endDay; i++) {
      const dayStart = clampStart(moment().subtract(i, 'days').startOf('day').toDate(), createdAt);
      const dayEnd = moment().subtract(i, 'days').endOf('day').toDate();
      if (dayStart > dayEnd) continue;
      const logs = await SmokeLog.find({ userId, timestamp: { $gte: dayStart, $lte: dayEnd } }).sort({ timestamp: 1 });
      if (logs.length < 2) continue;
      for (let j = 1; j < logs.length; j++) {
        gaps.push(moment(logs[j].timestamp).diff(moment(logs[j - 1].timestamp), 'minutes'));
      }
    }
    if (gaps.length === 0) return null;
    return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  const recentN = Math.min(3, daysAvail);
  const prevN = Math.min(3, Math.max(0, daysAvail - recentN));
  const currentAvgGap = await avgGapForDayRange(0, recentN);
  const previousAvgGap = prevN > 0 ? await avgGapForDayRange(recentN, recentN + prevN) : null;

  let changePercent = 0;
  if (previousAvgGap && previousAvgGap > 0 && currentAvgGap !== null) {
    changePercent = Math.round(((currentAvgGap - previousAvgGap) / previousAvgGap) * 100);
  }

  return { currentAvgGap, previousAvgGap, changePercent };
}

// ── Today's Trigger Breakdown ──
async function getTodayTriggerBreakdown(userId) {
  const start = moment().startOf('day').toDate();
  const end = moment().endOf('day').toDate();
  const logs = await SmokeLog.find({ userId, timestamp: { $gte: start, $lte: end }, trigger: { $ne: '' } });
  const total = await SmokeLog.countDocuments({ userId, timestamp: { $gte: start, $lte: end } });
  if (logs.length === 0) return { dominant: null, count: 0, total, percentage: 0 };
  const dist = {};
  logs.forEach(l => { dist[l.trigger] = (dist[l.trigger] || 0) + 1; });
  const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const [dominant, count] = sorted[0];
  return { dominant, count, total, percentage: total > 0 ? Math.round((count / total) * 100) : 0 };
}

// ── Weighted 7-day Trend (recent days have higher weight) ──
async function getWeightedTrend(userId, createdAt) {
  const daysAvail = daysSinceAnchor(createdAt);
  if (daysAvail < 2) return { direction: 'stable', percentChange: 0, recentAvg: 0, olderAvg: 0 };

  const recentN = Math.min(3, daysAvail);
  const olderN = Math.min(4, Math.max(0, daysAvail - recentN));

  // Recent days (0,1,2) — weights: 3,2,1
  let recentWeightedSum = 0, recentWeightTotal = 0;
  for (let i = 0; i < recentN; i++) {
    const dayStart = clampStart(moment().subtract(i, 'days').startOf('day').toDate(), createdAt);
    const dayEnd = moment().subtract(i, 'days').endOf('day').toDate();
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: dayStart, $lte: dayEnd } });
    const weight = recentN - i; // today=3, yesterday=2, day before=1
    recentWeightedSum += count * weight;
    recentWeightTotal += weight;
  }

  // Older days (3,4,5,6) — equal weight
  let olderSum = 0;
  for (let i = recentN; i < recentN + olderN; i++) {
    const dayStart = clampStart(moment().subtract(i, 'days').startOf('day').toDate(), createdAt);
    const dayEnd = moment().subtract(i, 'days').endOf('day').toDate();
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: dayStart, $lte: dayEnd } });
    olderSum += count;
  }

  const recentAvg = recentWeightTotal > 0 ? recentWeightedSum / recentWeightTotal : 0;
  const olderAvg = olderN > 0 ? olderSum / olderN : 0;

  let percentChange = 0;
  if (olderAvg > 0) {
    percentChange = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
  }

  let direction = 'stable';
  if (percentChange > 10) direction = 'worsening';
  else if (percentChange < -10) direction = 'improving';

  return {
    direction,
    percentChange,
    recentAvg: parseFloat(recentAvg.toFixed(1)),
    olderAvg: parseFloat(olderAvg.toFixed(1))
  };
}

// ── Consecutive days over daily limit ──
async function getConsecutiveLimitBreachDays(userId, createdAt) {
  const settings = (await require('../models/UserSettings').findOne({ userId })) || { dailyGoal: 5 };
  const goal = settings.dailyGoal;
  const daysAvail = daysSinceAnchor(createdAt);
  let streak = 0;
  for (let i = 0; i < Math.min(30, daysAvail); i++) {
    const dayStart = clampStart(moment().subtract(i, 'days').startOf('day').toDate(), createdAt);
    const dayEnd = moment().subtract(i, 'days').endOf('day').toDate();
    if (dayStart > dayEnd) break;
    const count = await SmokeLog.countDocuments({ userId, timestamp: { $gte: dayStart, $lte: dayEnd } });
    if (count > goal) streak++;
    else break;
  }
  return streak;
}

module.exports = {
  getEarliestLogDate,
  getHourlyDistribution,
  getPeakHour,
  getMovingAverage7Day,
  getTrend,
  getTodayCount,
  getWeeklyAverage,
  getAverageGap,
  detectRapidRepeat,
  getLastCigaretteMinutesAgo,
  getTotalLifetime,
  getDailyCounts,
  getWeeklyCounts,
  getMonthlyCounts,
  getYearlyCounts,
  getTodayTimeline,
  getTriggerDistribution,
  getMoodDistribution,
  getStreakData,
  getDailySummary,
  getDayOfWeekDistribution,
  getGapTrend,
  getTodayTriggerBreakdown,
  getWeightedTrend,
  getConsecutiveLimitBreachDays
};
