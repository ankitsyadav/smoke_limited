const patternService = require('../services/patternService');
const financialService = require('../services/financialService');

exports.getAnalytics = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const fallback = req.session.userCreatedAt;
    const earliest = await patternService.getEarliestLogDate(userId);
    const anchor = earliest || fallback; // Use first smoke log date, fallback to account creation
    const settings = await require('../models/UserSettings').findOne({ userId });
    const daily7 = await patternService.getMovingAverage7Day(userId, anchor);
    const hourly = await patternService.getHourlyDistribution(userId, 9999, anchor);
    const financials = await financialService.getFinancials(userId, anchor);
    const triggerDist = await patternService.getTriggerDistribution(userId, 9999, anchor);
    const moodDist = await patternService.getMoodDistribution(userId, 9999, anchor);
    const weekly4 = await patternService.getWeeklyCounts(userId, 52, anchor);
    const dayOfWeek = await patternService.getDayOfWeekDistribution(userId, 9999, anchor);
    const dailyGoal = settings ? settings.dailyGoal : 5;

    res.render('analytics', {
      title: 'Analytics',
      daily7: JSON.stringify(daily7),
      hourly: JSON.stringify(hourly),
      financials,
      triggerDist: JSON.stringify(triggerDist),
      moodDist: JSON.stringify(moodDist),
      weekly4: JSON.stringify(weekly4),
      dayOfWeek: JSON.stringify(dayOfWeek),
      dailyGoal
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

// AI Analytics — return raw data for Puter.js client-side AI
exports.getAnalyticsAI = async (req, res) => {
  try {
    const userId = req.session.userId;
    const fallback = req.session.userCreatedAt;
    const earliest = await patternService.getEarliestLogDate(userId);
    const anchor = earliest || fallback;
    const weeklyAvg = await patternService.getWeeklyAverage(userId, anchor);
    const trend = await patternService.getTrend(userId, anchor);
    const peakHour = await patternService.getPeakHour(userId, 9999, anchor);
    const totalLifetime = await patternService.getTotalLifetime(userId);
    const dailySummary = await patternService.getDailySummary(userId, 90, anchor);
    const triggerDist = await patternService.getTriggerDistribution(userId, 9999, anchor);
    const moodDist = await patternService.getMoodDistribution(userId, 9999, anchor);
    const avgGap = await patternService.getAverageGap(userId);
    const hourlyDist = await patternService.getHourlyDistribution(userId, 9999, anchor);

    const topTriggers = Object.entries(triggerDist).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}(${v})`).join(', ');
    const topMoods = Object.entries(moodDist).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}(${v})`).join(', ');

    // Build hourly breakdown string — only hours with count > 0
    const hourlyBreakdown = hourlyDist
      .map((count, hour) => count > 0 ? `${hour}:00=${count}` : null)
      .filter(Boolean)
      .join(', ');

    // Return raw data — Puter.js calls GPT on client
    res.json({
      weeklyAvg, trend, peakHour, totalLifetime, dailySummary,
      topTriggers, topMoods, avgGap,
      hourlyBreakdown: hourlyBreakdown || null
    });
  } catch (err) {
    console.error('[AnalyticsAI]', err);
    res.status(500).json({ insight: 'Error loading analytics data.' });
  }
};
