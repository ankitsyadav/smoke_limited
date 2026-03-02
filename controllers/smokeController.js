const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Kolkata');
const SmokeLog = require('../models/SmokeLog');
const UserSettings = require('../models/UserSettings');
const patternService = require('../services/patternService');
const predictionService = require('../services/predictionService');
const emailService = require('../services/emailService');

// AJAX endpoint — returns JSON, AI feedback handled client-side via Puter.js
exports.logSmokeAjax = async (req, res) => {
  try {
    const userId = req.session.userId;
    const createdAt = req.session.userCreatedAt;
    const { trigger, mood, note, customTimestamp } = req.body;

    // Use custom timestamp if provided (validate it's not in the future)
    let smokeTime = new Date();
    if (customTimestamp) {
      const parsed = new Date(customTimestamp);
      if (!isNaN(parsed.getTime())) {
        // Don't allow future timestamps (allow 2 min buffer for clock differences)
        const now = new Date();
        if (parsed.getTime() <= now.getTime() + 2 * 60000) {
          smokeTime = parsed;
        }
      }
    }

    // Save the smoke log
    await SmokeLog.create({
      userId,
      timestamp: smokeTime,
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

    // Send email if risk is HIGH (non-blocking)
    try {
      if (risk.riskLevel === 'HIGH') {
        await emailService.sendAlertEmail(userId, risk, 'Your risk level is HIGH. Try to pause and do some deep breathing.');
      }
    } catch (alertErr) {
      console.error('[ALERT] Non-fatal:', alertErr.message);
    }

    // Send pattern insight email (non-blocking, 4hr cooldown inside)
    try {
      const hourlyDist = await patternService.getHourlyDistribution(userId, 30, createdAt);
      const triggerDist = await patternService.getTriggerDistribution(userId, 30, createdAt);
      const topTriggerEntry = Object.entries(triggerDist).sort((a, b) => b[1] - a[1])[0];
      const topTrigger = topTriggerEntry ? `${topTriggerEntry[0]} (${topTriggerEntry[1]}x)` : '';

      emailService.sendPatternEmail(userId, {
        todayCount,
        dailyGoal: settings ? settings.dailyGoal : 5,
        peakHour,
        weeklyAvg: weeklyAvg.toFixed(1),
        trend,
        topTrigger,
        avgGap: lastGapMinutes,
        hourlyBreakdown: hourlyDist
      });
    } catch (patternErr) {
      console.error('[PATTERN-EMAIL] Non-fatal:', patternErr.message);
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
