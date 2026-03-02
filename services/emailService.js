const nodemailer = require('nodemailer');
const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Kolkata');
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
        <h1 style="color:#ff6b6b;text-align:center;">🚨 Smoking Risk Bahut High Hai!</h1>
        <div style="background:#16213e;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h2 style="color:#ff6b6b;margin:0 0 8px;">Risk Score: ${riskData.score}/100</h2>
          <p style="color:#ffd93d;font-weight:bold;">Level: ${riskData.riskLevel}</p>
        </div>
        <div style="background:#16213e;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="color:#6bff6b;">📊 Kya Trigger Kiya</h3>
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
          <h3 style="color:#6bff6b;">🤖 AI Ki Salah</h3>
          <p>${aiAdvice}</p>
        </div>
        <div style="text-align:center;padding:20px;background:linear-gradient(135deg,#6b8f71,#3d5a40);border-radius:8px;">
          <h2 style="color:#fff;margin:0;">💪 Tu craving se zyada strong hai.</h2>
          <p style="color:#d4edda;margin-top:8px;">Har ek resist teri jeet hai — keep going!</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: settings.email,
      subject: '🚨 Risk Bahut High — Sambhal Jao!',
      html
    });

    settings.lastEmailSent = new Date();
    await settings.save();
    console.log('[EMAIL] Alert sent to', settings.email);
  } catch (err) {
    console.error('[EMAIL] Failed to send alert:', err.message);
  }
}

module.exports = { sendAlertEmail, sendPatternEmail };

// ── Pattern Insight Email (sent after every smoke, 4hr cooldown) ──
async function sendPatternEmail(userId, patternData) {
  try {
    if (!isEmailConfigured()) return;

    const settings = await UserSettings.findOne({ userId });
    if (!settings || !settings.email) return;

    // 4 hour cooldown for pattern emails
    if (settings.lastPatternEmailSent && moment().diff(moment(settings.lastPatternEmailSent), 'hours') < 4) {
      return;
    }

    const transporter = createTransporter();
    if (!transporter) return;

    const { todayCount, dailyGoal, peakHour, weeklyAvg, trend, topTrigger, avgGap, hourlyBreakdown } = patternData;
    const overLimit = todayCount >= dailyGoal;
    const pct = dailyGoal > 0 ? Math.round((todayCount / dailyGoal) * 100) : 0;

    // Build hourly heatmap bar
    let heatmapHtml = '';
    if (hourlyBreakdown && hourlyBreakdown.length === 24) {
      const maxH = Math.max(...hourlyBreakdown);
      heatmapHtml = '<div style="display:flex;gap:2px;align-items:flex-end;height:40px;margin:12px 0;">';
      hourlyBreakdown.forEach((count, hr) => {
        const ratio = maxH > 0 ? count / maxH : 0;
        const h = Math.max(ratio * 36, 2);
        const color = ratio > 0.7 ? '#ff6b6b' : ratio > 0.3 ? '#ffd93d' : '#6b8f71';
        heatmapHtml += `<div style="width:12px;height:${h}px;background:${color};border-radius:2px;" title="${hr}:00 = ${count}"></div>`;
      });
      heatmapHtml += '</div><div style="display:flex;justify-content:space-between;font-size:9px;color:#888;"><span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span></div>';
    }

    const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#0a0f0d;color:#e0e0e0;border-radius:14px;border:1px solid #2a3a2e;">
        <div style="text-align:center;margin-bottom:16px;">
          <span style="font-size:24px;">${overLimit ? '🚨' : '📊'}</span>
          <h2 style="color:${overLimit ? '#ff6b6b' : '#a3c9a8'};margin:8px 0 4px;font-size:18px;">
            ${overLimit ? 'Limit Cross Ho Gaya!' : 'Smoking Pattern Update'}
          </h2>
          <p style="color:#8aa88a;margin:0;font-size:12px;">${moment().format('D MMM YYYY, h:mm A')} IST</p>
        </div>

        <div style="background:#141e16;padding:14px;border-radius:10px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-around;text-align:center;">
            <div>
              <div style="font-size:22px;font-weight:bold;color:${overLimit ? '#ff6b6b' : '#a3c9a8'};">${todayCount}/${dailyGoal}</div>
              <div style="font-size:10px;color:#8aa88a;">Today/Limit</div>
            </div>
            <div>
              <div style="font-size:22px;font-weight:bold;color:#ffd93d;">${peakHour}:00</div>
              <div style="font-size:10px;color:#8aa88a;">Peak Hour</div>
            </div>
            <div>
              <div style="font-size:22px;font-weight:bold;color:#a3c9a8;">${weeklyAvg}</div>
              <div style="font-size:10px;color:#8aa88a;">Daily Avg</div>
            </div>
          </div>
        </div>

        ${heatmapHtml ? `
        <div style="background:#141e16;padding:12px;border-radius:10px;margin-bottom:12px;">
          <div style="font-size:11px;color:#8aa88a;margin-bottom:4px;">⏰ Hourly Smoking Pattern</div>
          ${heatmapHtml}
        </div>
        ` : ''}

        <div style="background:#141e16;padding:12px;border-radius:10px;margin-bottom:12px;">
          <div style="font-size:12px;line-height:1.6;">
            ${topTrigger ? `<div>🔥 <strong>Top Trigger:</strong> <span style="color:#ffd93d;">${topTrigger}</span></div>` : ''}
            <div>📈 <strong>Trend:</strong> <span style="color:${trend === 'improving' ? '#6bff6b' : trend === 'worsening' ? '#ff6b6b' : '#ffd93d'};">${trend}</span></div>
            ${avgGap ? `<div>⏱️ <strong>Avg Gap:</strong> ${avgGap} min between cigs</div>` : ''}
          </div>
        </div>

        <div style="text-align:center;padding:14px;background:linear-gradient(135deg,#1a2e1e,#0a1a0d);border-radius:10px;border:1px solid #2a4a2e;">
          <div style="font-size:13px;color:#a3c9a8;font-weight:600;">
            ${overLimit ? '⛔ Aaj ka limit cross — ab har cigarette zyada damage karega' : `✅ ${dailyGoal - todayCount} aur slots bache — gap badhao`}
          </div>
        </div>

        <div style="text-align:center;margin-top:12px;font-size:9px;color:#555;">SmokeLimited • Pattern Insight</div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: settings.email,
      subject: overLimit
        ? `🚨 ${todayCount}/${dailyGoal} — Limit Cross! | SmokeLimited`
        : `📊 ${todayCount}/${dailyGoal} — Pattern Update | SmokeLimited`,
      html
    });

    settings.lastPatternEmailSent = new Date();
    await settings.save();
    console.log('[EMAIL] Pattern insight sent to', settings.email);
  } catch (err) {
    console.error('[EMAIL] Pattern email failed:', err.message);
  }
}
