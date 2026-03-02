const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Kolkata');
const UserSettings = require('../models/UserSettings');
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
    const weightedTrend = await patternService.getWeightedTrend(userId, createdAt);
    const nextCraving = await patternService.predictNextCraving(userId, createdAt);
    const triggerTimePatterns = await patternService.getTriggerTimeCorrelation(userId, createdAt);
    const achievements = await patternService.getAchievements(userId, createdAt);

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
      timeline,
      streak,
      weeklyAvg,
      weightedTrend,
      nextCraving,
      triggerTimePatterns,
      achievements
    });
  } catch (err) {
    next(err);
  }
};
