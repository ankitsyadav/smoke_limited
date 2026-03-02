const moment = require('moment');
const DailyHealthMetrics = require('../models/DailyHealthMetrics');
const UserSettings = require('../models/UserSettings');
const patternService = require('../services/patternService');

exports.getHealthForm = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const todayStart = moment().startOf('day').toDate();
    const existing = await DailyHealthMetrics.findOne({ userId, date: todayStart });
    // Get last AI health insight if available
    const healthInsight = req.query.insight || '';
    res.render('health', { title: 'Health Data', existing, healthInsight });
  } catch (err) {
    next(err);
  }
};

exports.saveHealth = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { hrv, restingHR, sleepScore, spo2 } = req.body;
    const todayStart = moment().startOf('day').toDate();

    await DailyHealthMetrics.findOneAndUpdate(
      { userId, date: todayStart },
      { userId, date: todayStart, hrv: Number(hrv), restingHR: Number(restingHR), sleepScore: Number(sleepScore), spo2: Number(spo2) },
      { upsert: true, new: true }
    );

    // AI insight now handled client-side via Puter.js
    res.redirect('/health');
  } catch (err) {
    next(err);
  }
};

// API endpoint — returns raw health + smoking context for client-side Puter AI
exports.getHealthAI = async (req, res) => {
  try {
    const userId = req.session.userId;
    const todayStart = moment().startOf('day').toDate();
    const health = await DailyHealthMetrics.findOne({ userId, date: todayStart });
    if (!health) return res.json({ noData: true, insight: 'No health data for today. Enter your metrics first.' });

    const settings = await UserSettings.findOne({ userId });
    const todayCount = await patternService.getTodayCount(userId);
    const weeklyAvg = await patternService.getWeeklyAverage(userId, req.session.userCreatedAt);
    const trend = await patternService.getTrend(userId, req.session.userCreatedAt);

    const yStart = moment().subtract(1, 'day').startOf('day').toDate();
    const yEnd = moment().subtract(1, 'day').endOf('day').toDate();
    const SmokeLog = require('../models/SmokeLog');
    const yesterdayCount = await SmokeLog.countDocuments({ userId, timestamp: { $gte: yStart, $lte: yEnd } });

    // Return raw data — Puter.js calls GPT on client
    res.json({
      noData: false,
      hrv: health.hrv,
      restingHR: health.restingHR,
      sleepScore: health.sleepScore,
      spo2: health.spo2,
      baselineHRV: settings ? settings.baselineHRV : 50,
      todayCount,
      weeklyAvg,
      trend,
      yesterdayCount
    });
  } catch (err) {
    console.error('[HealthAI]', err);
    res.status(500).json({ insight: 'Error loading health data.' });
  }
};
