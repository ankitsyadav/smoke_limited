// Cron service — no email notifications, only periodic risk scoring
const cron = require('node-cron');
const predictionService = require('./predictionService');
const User = require('../models/User');

function startCronJobs() {
  // Periodic risk check — logs only, no notifications
  cron.schedule('*/30 * * * *', async () => {
    try {
      const users = await User.find({});
      for (const user of users) {
        try {
          const risk = await predictionService.calculateRiskScore(user._id, user.createdAt);
          if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') {
            console.log(`[CRON] ⚠️ ${user.name}: Risk ${risk.score} (${risk.riskLevel})`);
          }
        } catch (userErr) {
          console.error(`[CRON] Error for ${user.name}:`, userErr.message);
        }
      }
    } catch (err) {
      console.error('[CRON] Error:', err.message);
    }
  });
  console.log('[CRON] Scheduled risk check every 30 min.');
}

module.exports = { startCronJobs };
