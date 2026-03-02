const moment = require('moment');
const SmokeLog = require('../models/SmokeLog');
const UserSettings = require('../models/UserSettings');
const DailyHealthMetrics = require('../models/DailyHealthMetrics');
const patternService = require('../services/patternService');
const predictionService = require('../services/predictionService');
const emailService = require('../services/emailService');

// AJAX endpoint — returns JSON, AI feedback handled client-side via Puter.js
exports.logSmokeAjax = async (req, res) => {
  try {
    const userId = req.session.userId;
    const createdAt = req.session.userCreatedAt;
    const { trigger, mood, note } = req.body;

    // Save the smoke log
    await SmokeLog.create({
      userId,
      timestamp: new Date(),
      trigger: trigger || '',
      mood: mood || '',
      note: note || ''
    });

    // Gather context
    const settings = await UserSettings.findOne({ userId });
    const todayCount = await patternService.getTodayCount(userId);
    const weeklyAvg = await patternService.getWeeklyAverage(userId, createdAt);
    const trend = await patternService.getTrend(userId, createdAt);
    const peakHour = await patternService.getPeakHour(userId, 30, createdAt);
    const lastGapMinutes = await patternService.getAverageGap(userId);
    const rapidRepeat = await patternService.detectRapidRepeat(userId);
    const risk = await predictionService.calculateRiskScore(userId, createdAt);

    const todayStart = moment().startOf('day').toDate();
    const health = await DailyHealthMetrics.findOne({ userId, date: todayStart });

    // Send email if risk is HIGH (non-blocking)
    try {
      if (risk.riskLevel === 'HIGH') {
        await emailService.sendAlertEmail(userId, risk, 'Your risk level is HIGH. Try to pause and do some deep breathing.');
      }
    } catch (alertErr) {
      console.error('[ALERT] Non-fatal:', alertErr.message);
    }

    // Get today's timeline
    const todayLogs = await SmokeLog.find({
      userId, timestamp: { $gte: todayStart, $lte: moment().endOf('day').toDate() }
    }).sort({ timestamp: 1 });

    const timeline = todayLogs.map(l => ({
      time: moment(l.timestamp).format('h:mm A'),
      trigger: l.trigger || '',
      mood: l.mood || ''
    }));

    // Return all context — Puter.js on client will call GPT for AI feedback
    res.json({
      success: true,
      todayCount,
      dailyGoal: settings ? settings.dailyGoal : 5,
      weeklyAvg: weeklyAvg.toFixed(1),
      trend,
      peakHour,
      lastGapMinutes,
      risk: { score: risk.score, riskLevel: risk.riskLevel },
      rapidRepeat,
      trigger: trigger || '',
      mood: mood || '',
      health: health ? { hrv: health.hrv, sleepScore: health.sleepScore, spo2: health.spo2 } : null,
      timeline
    });
  } catch (err) {
    console.error('[LogSmoke]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Form POST fallback
exports.logSmoke = async (req, res, next) => {
  try {
    await SmokeLog.create({ userId: req.session.userId, timestamp: new Date() });
    res.redirect('/');
  } catch (err) {
    next(err);
  }
};
