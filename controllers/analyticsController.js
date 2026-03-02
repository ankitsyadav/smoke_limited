const patternService = require('../services/patternService');
const financialService = require('../services/financialService');

exports.getAnalytics = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const createdAt = req.session.userCreatedAt;
    const daily7 = await patternService.getMovingAverage7Day(userId, createdAt);
    const hourly = await patternService.getHourlyDistribution(userId, 30, createdAt);
    const financials = await financialService.getFinancials(userId, createdAt);
    const triggerDist = await patternService.getTriggerDistribution(userId, 30, createdAt);
    const moodDist = await patternService.getMoodDistribution(userId, 30, createdAt);

    res.render('analytics', {
      title: 'Analytics',
      daily7: JSON.stringify(daily7),
      hourly: JSON.stringify(hourly),
      financials,
      triggerDist: JSON.stringify(triggerDist),
      moodDist: JSON.stringify(moodDist)
    });
  } catch (err) {
    next(err);
  }
};

exports.getAnalyticsData = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const createdAt = req.session.userCreatedAt;
    const range = req.query.range || 'daily';
    let trendData;
    let hourlyDays;

    switch (range) {
      case 'daily':
        trendData = await patternService.getDailyCounts(userId, 7, createdAt);
        hourlyDays = 7;
        break;
      case 'weekly':
        trendData = await patternService.getWeeklyCounts(userId, 12, createdAt);
        hourlyDays = 84;
        break;
      case 'monthly':
        trendData = await patternService.getMonthlyCounts(userId, 12, createdAt);
        hourlyDays = 365;
        break;
      case 'yearly':
        trendData = await patternService.getYearlyCounts(userId, 5, createdAt);
        hourlyDays = 1825;
        break;
      default:
        trendData = await patternService.getDailyCounts(userId, 7, createdAt);
        hourlyDays = 7;
    }

    const hourly = await patternService.getHourlyDistribution(userId, hourlyDays, createdAt);
    res.json({ trendData, hourly });
  } catch (err) {
    next(err);
  }
};

// AI Analytics — return raw data for Puter.js client-side AI
exports.getAnalyticsAI = async (req, res) => {
  try {
    const userId = req.session.userId;
    const createdAt = req.session.userCreatedAt;
    const weeklyAvg = await patternService.getWeeklyAverage(userId, createdAt);
    const trend = await patternService.getTrend(userId, createdAt);
    const peakHour = await patternService.getPeakHour(userId, 30, createdAt);
    const totalLifetime = await patternService.getTotalLifetime(userId);
    const dailySummary = await patternService.getDailySummary(userId, 7, createdAt);
    const triggerDist = await patternService.getTriggerDistribution(userId, 30, createdAt);
    const moodDist = await patternService.getMoodDistribution(userId, 30, createdAt);
    const avgGap = await patternService.getAverageGap(userId);
    const hourlyDist = await patternService.getHourlyDistribution(userId, 30, createdAt);

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
