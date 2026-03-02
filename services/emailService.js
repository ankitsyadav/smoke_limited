const nodemailer = require('nodemailer');
const moment = require('moment');
const UserSettings = require('../models/UserSettings');

function isEmailConfigured() {
  return (
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_USER !== 'your_gmail@gmail.com' &&
    process.env.EMAIL_PASS !== 'your_gmail_app_password'
  );
}

function createTransporter() {
  if (!isEmailConfigured()) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

async function sendAlertEmail(userId, riskData, aiAdvice) {
  try {
    if (!isEmailConfigured()) {
      console.log('[EMAIL] Skipped — email credentials not configured in .env');
      return;
    }

    const settings = await UserSettings.findOne({ userId });
    if (!settings || !settings.email) return;

    if (settings.lastEmailSent && moment().diff(moment(settings.lastEmailSent), 'hours') < 2) {
      console.log('[EMAIL] Skipped — cooldown (last sent < 2 hours ago)');
      return;
    }

    const transporter = createTransporter();
    if (!transporter) return;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1a1a2e;color:#e0e0e0;border-radius:12px;">
        <h1 style="color:#ff6b6b;text-align:center;">🚨 High Smoking Risk Detected</h1>
        <div style="background:#16213e;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h2 style="color:#ff6b6b;margin:0 0 8px;">Risk Score: ${riskData.score}/100</h2>
          <p style="color:#ffd93d;font-weight:bold;">Level: ${riskData.riskLevel}</p>
        </div>
        <div style="background:#16213e;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="color:#6bff6b;">📊 Trigger Reasons</h3>
          <ul>
            ${riskData.flags.map(f => '<li style="margin-bottom:4px;">' + f + '</li>').join('')}
          </ul>
        </div>
        <div style="background:#16213e;padding:16px;border-radius:8px;margin-bottom:16px;">
          <p><strong>Today Count:</strong> ${riskData.todayCount}</p>
          <p><strong>Peak Hour:</strong> ${riskData.peakHour}:00</p>
          <p><strong>Trend:</strong> ${riskData.trend}</p>
        </div>
        <div style="background:#0f3460;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="color:#6bff6b;">🤖 AI Advice</h3>
          <p>${aiAdvice}</p>
        </div>
        <div style="text-align:center;padding:20px;background:linear-gradient(135deg,#6b8f71,#3d5a40);border-radius:8px;">
          <h2 style="color:#fff;margin:0;">💪 You are stronger than this craving.</h2>
          <p style="color:#d4edda;margin-top:8px;">Every moment you resist is a victory for your health and future.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: settings.email,
      subject: '🚨 High Smoking Risk Detected',
      html
    });

    settings.lastEmailSent = new Date();
    await settings.save();
    console.log('[EMAIL] Alert sent to', settings.email);
  } catch (err) {
    console.error('[EMAIL] Failed to send alert:', err.message);
  }
}

module.exports = { sendAlertEmail };
