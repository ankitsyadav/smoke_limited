const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Kolkata');
const patternService = require('./patternService');
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

  if (Math.abs(nowHour - peakHour) <= 1 || (nowHour === peakHour)) {
    score += 25;
    flags.push('Peak smoking hour ke aas-paas ho');
  }

  if (lastMinutes !== null && lastMinutes < 90) {
    score += 15;
    flags.push('Last cigarette 90 min se kam pehle thi');
  }

  if (todayCount > weeklyAvg) {
    score += 20;
    flags.push('Aaj weekly average se zyada smoke kiya');
  }

  const dailyGoal = settings ? settings.dailyGoal : 5;
  if (todayCount >= dailyGoal) {
    score += 20;
    flags.push(`Limit cross! ${todayCount}/${dailyGoal} ho gaye`);
  }

  if (trend === 'worsening') {
    score += 20;
    flags.push('Trend bigad raha hai — pichle hafte se zyada');
  }

  score = Math.min(score, 100);

  let riskLevel = 'LOW';
  if (score >= 60) riskLevel = 'HIGH';
  else if (score >= 40) riskLevel = 'MEDIUM';

  return { score, riskLevel, flags, todayCount, peakHour, trend };
}

module.exports = { calculateRiskScore };
