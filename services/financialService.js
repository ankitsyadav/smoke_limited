const UserSettings = require('../models/UserSettings');
const patternService = require('./patternService');

async function getFinancials(userId, createdAt) {
  const settings = await UserSettings.findOne({ userId });
  const cost = settings ? settings.costPerCigarette : 0;
  const todayCount = await patternService.getTodayCount(userId);
  const totalLifetime = await patternService.getTotalLifetime(userId);
  const weeklyAvg = await patternService.getWeeklyAverage(userId, createdAt);

  return {
    dailyCost: (todayCount * cost).toFixed(2),
    monthlyCost: (weeklyAvg * 30 * cost).toFixed(2),
    yearlyCost: (weeklyAvg * 365 * cost).toFixed(2),
    lifetimeCigarettes: totalLifetime,
    lifetimeCost: (totalLifetime * cost).toFixed(2)
  };
}

module.exports = { getFinancials };
