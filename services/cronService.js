const cron = require('node-cron');
const predictionService = require('./predictionService');
const emailService = require('./emailService');
const User = require('../models/User');

function startCronJobs() {
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('[CRON] Running risk check for all users...');
      const users = await User.find({});
      for (const user of users) {
        try {
          const risk = await predictionService.calculateRiskScore(user._id, user.createdAt);
          if (risk.riskLevel === 'HIGH') {
            await emailService.sendAlertEmail(user._id, risk, 'Your risk level is HIGH. Try to pause and do some deep breathing.');
            console.log(`[CRON] High risk for ${user.name} — email sent.`);
          } else {
            console.log(`[CRON] ${user.name}: Risk ${risk.score} (${risk.riskLevel}) — no alert.`);
          }
        } catch (userErr) {
          console.error(`[CRON] Error for user ${user.name}:`, userErr.message);
        }
      }
    } catch (err) {
      console.error('[CRON] Error:', err.message);
    }
  });
  console.log('[CRON] Scheduled risk check every 30 minutes (all users).');
}

module.exports = { startCronJobs };
