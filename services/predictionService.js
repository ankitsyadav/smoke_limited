const moment = require('moment');
const patternService = require('./patternService');
const DailyHealthMetrics = require('../models/DailyHealthMetrics');
const UserSettings = require('../models/UserSettings');

async function calculateRiskScore(userId, createdAt) {
  const flags = [];
  let score = 0;

  const settings = await UserSettings.findOne({ userId });
  const peakHour = await patternService.getPeakHour(userId, 30, createdAt);
  const nowHour = moment().hour();
  const lastMinutes = await patternService.getLastCigaretteMinutesAgo(userId);
  const todayCount = await patternService.getTodayCount(userId);
  const weeklyAvg = await patternService.getWeeklyAverage(userId, createdAt);
  const trend = await patternService.getTrend(userId, createdAt);

  const todayStart = moment().startOf('day').toDate();
  const health = await DailyHealthMetrics.findOne({ userId, date: todayStart });

  if (Math.abs(nowHour - peakHour) <= 1 || (nowHour === peakHour)) {
    score += 25;
    flags.push('Within peak smoking hour window');
  }

  if (lastMinutes !== null && lastMinutes < 90) {
    score += 15;
    flags.push('Last cigarette was less than 90 minutes ago');
  }

  if (todayCount > weeklyAvg) {
    score += 15;
    flags.push('Today count exceeds weekly average');
  }

  if (health && settings && settings.baselineHRV && health.hrv < settings.baselineHRV) {
    score += 20;
    flags.push('HRV below baseline');
  }

  if (health && health.sleepScore < 70) {
    score += 10;
    flags.push('Sleep score below 70');
  }

  if (trend === 'worsening') {
    score += 15;
    flags.push('Smoking trend is worsening');
  }

  score = Math.min(score, 100);

  let riskLevel = 'LOW';
  if (score >= 60) riskLevel = 'HIGH';
  else if (score >= 40) riskLevel = 'MEDIUM';

  return { score, riskLevel, flags, todayCount, peakHour, trend };
}

module.exports = { calculateRiskScore };
