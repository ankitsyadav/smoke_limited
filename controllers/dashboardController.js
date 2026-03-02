const moment = require('moment');
const UserSettings = require('../models/UserSettings');
const DailyHealthMetrics = require('../models/DailyHealthMetrics');
const patternService = require('../services/patternService');
const predictionService = require('../services/predictionService');
const financialService = require('../services/financialService');

exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const createdAt = req.session.userCreatedAt;
    const settings = await UserSettings.findOne({ userId });
    if (!settings) return res.redirect('/settings');

    const todayCount = await patternService.getTodayCount(userId);
    const peakHour = await patternService.getPeakHour(userId, 30, createdAt);
    const trend = await patternService.getTrend(userId, createdAt);
    const avgGap = await patternService.getAverageGap(userId);
    const rapidRepeat = await patternService.detectRapidRepeat(userId);
    const risk = await predictionService.calculateRiskScore(userId, createdAt);
    const financials = await financialService.getFinancials(userId, createdAt);
    const timeline = await patternService.getTodayTimeline(userId);
    const streak = await patternService.getStreakData(userId, createdAt);
    const weeklyAvg = await patternService.getWeeklyAverage(userId, createdAt);

    const todayStart = moment().startOf('day').toDate();
    const health = await DailyHealthMetrics.findOne({ userId, date: todayStart });

    // AI advice now handled client-side via Puter.js (free GPT-4.1)
    // Pass all context as JSON for the client to use
    res.render('dashboard', {
      title: 'Dashboard',
      settings,
      todayCount,
      peakHour,
      trend,
      avgGap,
      rapidRepeat,
      risk,
      financials,
      health,
      timeline,
      streak,
      weeklyAvg
    });
  } catch (err) {
    next(err);
  }
};
