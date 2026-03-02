const axios = require('axios');

const API_URL = 'https://api.x.ai/v1/chat/completions';
const MODEL = 'grok-3-mini';
const TIMEOUT = 30000;

function headers() {
  return {
    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function callGrok(systemPrompt, userPrompt) {
  if (!process.env.GROK_API_KEY) return null;
  try {
    const res = await axios.post(API_URL, {
      model: MODEL,
      temperature: 0.7,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }, { headers: headers(), timeout: TIMEOUT });
    return res.data.choices[0].message.content;
  } catch (err) {
    console.error('[Grok]', err.response ? `${err.response.status} - ${JSON.stringify(err.response.data).slice(0, 200)}` : err.message);
    return null;
  }
}

// ── Dashboard general advice ──
async function getAIAdvice(data) {
  const prompt = `User stats: ${data.todayCount} cigarettes today, peak hour ${data.peakHour}:00, trend ${data.trend}, risk ${data.score}/100 (${data.riskLevel}). Flags: ${data.flags.join(', ')}. HRV: ${data.hrv || 'N/A'}. Sleep: ${data.sleepScore || 'N/A'}. SpO2: ${data.spo2 || 'N/A'}. Give 1 specific actionable tip to reduce smoking right now.`;
  const result = await callGrok(
    'You are a behavioral addiction expert. Be concise, practical, personal. Max 80 words. Use Hindi-English mix if the data feels Indian context.',
    prompt
  );
  return result || getDefaultAdvice();
}

// ── Called RIGHT after logging a cigarette ──
async function getSmokeFeedback(ctx) {
  const triggerText = ctx.trigger ? `Trigger: ${ctx.trigger}.` : '';
  const moodText = ctx.mood ? `Current mood: ${ctx.mood}.` : '';
  const healthText = ctx.hrv ? `Health today — HRV: ${ctx.hrv}, Sleep: ${ctx.sleepScore}/100, SpO2: ${ctx.spo2}%.` : '';
  const gapText = ctx.lastGapMinutes ? `Last cigarette was ${ctx.lastGapMinutes} minutes ago.` : '';

  const prompt = `User just smoked their ${ctx.todayCount}${ordinal(ctx.todayCount)} cigarette today. ${triggerText} ${moodText} ${gapText} Daily goal: ${ctx.dailyGoal}. Weekly avg: ${ctx.weeklyAvg.toFixed(1)}/day. Trend: ${ctx.trend}. ${healthText} Peak hour: ${ctx.peakHour}:00. Give immediate, personal feedback about this cigarette — acknowledge the trigger/mood if present. Be empathetic but firm. Suggest one specific thing to do RIGHT NOW. Max 100 words.`;

  const result = await callGrok(
    'You are a supportive but honest smoking reduction coach. Mix empathy with tough love. Be specific and personal. If health data shows impact, mention it directly.',
    prompt
  );
  return result || getSmokeFallback(ctx);
}

// ── Called after health data entry ──
async function getHealthInsight(ctx) {
  const prompt = `User health data: HRV ${ctx.hrv} (baseline ${ctx.baselineHRV}), Resting HR ${ctx.restingHR} bpm, Sleep Score ${ctx.sleepScore}/100, SpO2 ${ctx.spo2}%. Smoking data: ${ctx.todayCount} cigarettes today, ${ctx.weeklyAvg.toFixed(1)}/day avg, trend ${ctx.trend}. ${ctx.yesterdayCount !== null ? `Yesterday: ${ctx.yesterdayCount} cigarettes.` : ''} Analyze the connection between their health metrics and smoking pattern. What does HRV + sleep + SpO2 tell about nicotine's impact on their body right now? Give actionable health-specific advice. Max 120 words.`;

  const result = await callGrok(
    'You are a health analytics expert specializing in smoking impact on biometrics. Be data-driven. Connect specific metrics to smoking behavior. Be direct about health consequences.',
    prompt
  );
  return result || getHealthFallback(ctx);
}

// ── Called for analytics page deep insights ──
async function getAnalyticsInsight(ctx) {
  const topTriggers = ctx.topTriggers ? `Top triggers: ${ctx.topTriggers}.` : '';
  const topMoods = ctx.topMoods ? `Common moods when smoking: ${ctx.topMoods}.` : '';

  const prompt = `Smoking analytics for user: Daily counts (last 7 days): ${ctx.dailySummary}. Weekly avg: ${ctx.weeklyAvg.toFixed(1)}. Trend: ${ctx.trend}. Peak hour: ${ctx.peakHour}:00. Total lifetime: ${ctx.totalLifetime}. ${topTriggers} ${topMoods} ${ctx.healthSummary || ''} Provide a deep analytical insight. Identify patterns, predict next high-risk period, and give 2-3 strategic recommendations. Max 150 words.`;

  const result = await callGrok(
    'You are a data analyst specializing in behavioral addiction patterns. Identify non-obvious patterns and correlations. Be analytical and strategic. Provide predictions.',
    prompt
  );
  return result || getAnalyticsFallback(ctx);
}

// ── Fallbacks ──
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return (s[(v - 20) % 10] || s[v] || s[0]);
}

function getDefaultAdvice() {
  const tips = [
    'Take 10 deep breaths right now. Inhale 4 seconds, hold 4, exhale 6. This activates your parasympathetic nervous system and reduces cravings.',
    'Drink a full glass of cold water. Hydration reduces nicotine cravings. Go for a 5-minute walk outside.',
    'Chew sugar-free gum or eat a crunchy snack. Keep your hands busy with a stress ball or fidget spinner.',
    'Call or text someone you care about. Social connection releases oxytocin which naturally reduces craving intensity.',
    'Do 20 jumping jacks or push-ups. Exercise releases endorphins that directly compete with nicotine cravings.'
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function getSmokeFallback(ctx) {
  const msgs = [];
  if (ctx.todayCount > ctx.dailyGoal) {
    msgs.push(`You've exceeded your daily goal of ${ctx.dailyGoal}. Try to hold off the next one for at least 2 hours.`);
  } else if (ctx.todayCount === ctx.dailyGoal) {
    msgs.push(`You've hit your daily limit of ${ctx.dailyGoal}. Challenge yourself — no more today. You can do this.`);
  } else {
    msgs.push(`${ctx.dailyGoal - ctx.todayCount} remaining before your daily goal. Try to stretch the gap between cigarettes.`);
  }
  if (ctx.trigger === 'stress') msgs.push('Stress triggered this one — try 5 minutes of deep breathing next time.');
  if (ctx.trigger === 'boredom') msgs.push('Boredom triggered this — keep a small task list for these moments.');
  if (ctx.lastGapMinutes && ctx.lastGapMinutes < 60) msgs.push('⚠️ That was a rapid repeat. Try to delay at least 60 minutes between cigarettes.');
  return msgs.join(' ');
}

function getHealthFallback(ctx) {
  const msgs = [];
  if (ctx.hrv < ctx.baselineHRV) {
    msgs.push(`Your HRV (${ctx.hrv}) is below your baseline (${ctx.baselineHRV}). Smoking directly reduces HRV by increasing sympathetic nervous activity.`);
  } else {
    msgs.push(`Your HRV (${ctx.hrv}) is at or above baseline — good sign. Keep reducing cigarettes to maintain this.`);
  }
  if (ctx.sleepScore < 70) msgs.push(`Sleep score ${ctx.sleepScore} is low. Nicotine within 3 hours of bed disrupts sleep cycles.`);
  if (ctx.spo2 < 96) msgs.push(`SpO2 at ${ctx.spo2}% — smoking reduces oxygen saturation. Even a 1% drop matters.`);
  msgs.push('Try to avoid smoking 3 hours before sleep to improve tomorrow\'s metrics.');
  return msgs.join(' ');
}

function getAnalyticsFallback(ctx) {
  const msgs = [`Your weekly average is ${ctx.weeklyAvg.toFixed(1)} cigarettes/day.`];
  if (ctx.trend === 'worsening') msgs.push('Your trend is worsening — focus on reducing by just 1 cigarette per day this week.');
  else if (ctx.trend === 'improving') msgs.push('Your trend is improving! Keep this momentum going.');
  else msgs.push('Your pattern is stable. Try to break the plateau by cutting 1 cigarette.');
  msgs.push(`Peak smoking hour is ${ctx.peakHour}:00 — plan alternative activities during this time.`);
  if (ctx.topTriggers) msgs.push(`Your top trigger is ${ctx.topTriggers.split(',')[0].trim()} — develop a specific counter-strategy for it.`);
  return msgs.join(' ');
}

module.exports = { getAIAdvice, getSmokeFeedback, getHealthInsight, getAnalyticsInsight };
