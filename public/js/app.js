document.addEventListener('DOMContentLoaded', function () {
  const oliveLight = '#a3c9a8';
  const olive = '#6b8f71';
  const oliveDark = '#3d5a40';
  const gridColor = 'rgba(107, 143, 113, 0.12)';
  const tickColor = '#8aa88a';

  const AI_MODEL = 'gpt-4.1';

  // Helper: convert 24h hour to AM/PM
  function toAMPM(h) {
    const hr = parseInt(h, 10);
    if (isNaN(hr)) return h;
    const suffix = hr >= 12 ? 'PM' : 'AM';
    const h12 = hr % 12 || 12;
    return h12 + suffix;
  }

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor } },
      y: { ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor }, beginAtZero: true }
    }
  };

  const rangeTitles = {
    daily: { trend: 'Last 7 Days', hourly: 'Hourly Distribution (7 Days)' },
    weekly: { trend: 'Last 12 Weeks', hourly: 'Hourly Distribution (12 Weeks)' },
    monthly: { trend: 'Last 12 Months', hourly: 'Hourly Distribution (12 Months)' },
    yearly: { trend: 'Last 5 Years', hourly: 'Hourly Distribution (All Time)' }
  };

  let trendChart = null, hourlyChart = null, triggerChartObj = null, moodChartObj = null;

  // ══════════════════════════════════════
  // ── PUTER.JS AI HELPER (FREE GPT) ──
  // ══════════════════════════════════════
  async function callPuterAI(systemPrompt, userPrompt) {
    try {
      // Merge system + user into one prompt so model can't ignore instructions
      const merged = systemPrompt + '\n\n--- USER DATA ---\n' + userPrompt;
      const resp = await puter.ai.chat(merged, {
        model: AI_MODEL
      });
      // puter.ai.chat returns { message: { content: "..." } } or a string
      if (typeof resp === 'string') return resp;
      if (resp && resp.message && resp.message.content) return resp.message.content;
      if (resp && resp.toString) return resp.toString();
      return 'AI response unavailable.';
    } catch (err) {
      console.error('[PuterAI]', err);
      return 'AI temporarily unavailable. Stay strong — every skipped cigarette counts.';
    }
  }

  // ── Format GPT plain/markdown text → styled HTML ──
  function formatAIText(raw) {
    if (!raw) return '';
    let t = raw.trim();

    // Escape HTML
    t = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // **bold** → <strong>
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // *italic* → <em> (single asterisks not adjacent to spaces)
    t = t.replace(/(?<![\w*])\*([^*]+?)\*(?![\w*])/g, '<em>$1</em>');

    // Split into lines
    let lines = t.split(/\n/);
    let html = '';
    let inList = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) { html += '</ul>'; inList = false; }
        return;
      }

      // Bullet: - or • or * at start, or numbered 1. 2.
      const bulletMatch = trimmed.match(/^(?:[-•*]|\d+[\.\)])\s+(.+)/);
      if (bulletMatch) {
        if (!inList) { html += '<ul class="ai-list">'; inList = true; }
        html += '<li>' + bulletMatch[1] + '</li>';
        return;
      }

      if (inList) { html += '</ul>'; inList = false; }

      // Heading-like: lines ending with : or starting with emoji
      if (/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(trimmed)) {
        html += '<p class="ai-para ai-emoji-line">' + trimmed + '</p>';
        return;
      }

      html += '<p class="ai-para">' + trimmed + '</p>';
    });

    if (inList) html += '</ul>';

    // If no <p> or <ul> were created (single line no newlines), wrap it
    if (!html.includes('<p') && !html.includes('<ul')) {
      html = '<p class="ai-para">' + t + '</p>';
    }

    return html;
  }

  // ── Chart builders ──
  function buildTrendChart(data) {
    const ctx = document.getElementById('dailyChart');
    if (!ctx) return;
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.date),
        datasets: [{
          data: data.map(d => d.count),
          borderColor: olive, backgroundColor: 'rgba(107, 143, 113, 0.15)',
          borderWidth: 2.5, fill: true, tension: 0.4,
          pointBackgroundColor: oliveLight, pointBorderColor: oliveDark,
          pointRadius: data.length > 20 ? 2 : 5, pointHoverRadius: 8,
          pointHoverBackgroundColor: '#fff', pointHoverBorderColor: olive, pointHoverBorderWidth: 3
        }]
      },
      options: chartDefaults
    });
  }

  function buildHourlyChart(data) {
    const ctx = document.getElementById('hourlyChart');
    if (!ctx) return;
    if (hourlyChart) hourlyChart.destroy();
    const labels = Array.from({length: 24}, (_, i) => i + ':00');
    const maxVal = Math.max(...data);
    const colors = data.map(v => {
      const ratio = maxVal > 0 ? v / maxVal : 0;
      if (ratio > 0.8) return 'rgba(255, 107, 107, 0.8)';
      if (ratio > 0.5) return 'rgba(255, 217, 61, 0.7)';
      return 'rgba(107, 143, 113, 0.6)';
    });
    hourlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels, datasets: [{
          data, backgroundColor: colors,
          borderColor: colors.map(c => c.replace(/[\d.]+\)$/, '1)')),
          borderWidth: 1, borderRadius: 6, borderSkipped: false
        }]
      },
      options: { ...chartDefaults, scales: { ...chartDefaults.scales, x: { ...chartDefaults.scales.x, ticks: { color: tickColor, font: { size: 8 }, maxRotation: 45 } } } }
    });
  }

  function buildPieChart(canvasId, dist, colorPalette) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const labels = Object.keys(dist);
    const data = Object.values(dist);
    if (labels.length === 0) {
      ctx.getContext('2d').font = '12px sans-serif';
      ctx.getContext('2d').fillStyle = '#8aa88a';
      ctx.getContext('2d').textAlign = 'center';
      ctx.getContext('2d').fillText('No data yet', ctx.width / 2, ctx.height / 2);
      return null;
    }
    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels, datasets: [{
          data, backgroundColor: colorPalette.slice(0, labels.length),
          borderColor: 'rgba(10,15,13,0.8)', borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: tickColor, font: { size: 9 }, padding: 6, boxWidth: 10 } }
        }
      }
    });
  }

  // ── Initial render ──
  if (window.__daily7) buildTrendChart(window.__daily7);
  if (window.__hourly) buildHourlyChart(window.__hourly);

  const triggerColors = ['#ff6b6b', '#ffd93d', '#6bff6b', '#6bb5ff', '#ff6bff', '#ffaa6b', '#6bffd9', '#d96bff'];
  const moodColors = ['#ff6b6b', '#ffaa6b', '#ffd93d', '#6bff6b', '#6bb5ff', '#d96bff', '#ff6bff', '#6bffd9'];

  if (window.__triggerDist) triggerChartObj = buildPieChart('triggerChart', window.__triggerDist, triggerColors);
  if (window.__moodDist) moodChartObj = buildPieChart('moodChart', window.__moodDist, moodColors);

  // ── Dropdown range switcher ──
  const rangeSelect = document.getElementById('rangeSelect');
  if (rangeSelect) {
    rangeSelect.addEventListener('change', async function () {
      const range = this.value;
      const loader = document.getElementById('chartLoader');
      if (loader) loader.style.display = 'block';
      try {
        const res = await fetch('/api/analytics?range=' + range);
        const data = await res.json();
        const t = rangeTitles[range];
        const tt = document.getElementById('trendTitle');
        const ht = document.getElementById('hourlyTitle');
        if (tt) tt.textContent = t.trend;
        if (ht) ht.textContent = t.hourly;
        buildTrendChart(data.trendData);
        buildHourlyChart(data.hourly);
      } catch (err) { console.error('Analytics fetch error:', err); }
      finally { if (loader) loader.style.display = 'none'; }
    });
  }

  // ══════════════════════════════════════
  // ── SMOKE MODAL + AJAX LOGGING ──
  // ══════════════════════════════════════
  let selectedTrigger = '';
  let selectedMood = '';

  // Trigger chip selection
  document.querySelectorAll('.trigger-chip').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.trigger-chip').forEach(b => b.classList.remove('chip-active'));
      this.classList.add('chip-active');
      selectedTrigger = this.dataset.val;
    });
  });

  // Mood chip selection
  document.querySelectorAll('.mood-chip').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.mood-chip').forEach(b => b.classList.remove('chip-active'));
      this.classList.add('chip-active');
      selectedMood = this.dataset.val;
    });
  });

  // ── Date/Time picker state ──
  let dtMode = 'now'; // 'now' or 'custom'

  function getISTNow() {
    // IST = UTC + 5:30
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 5.5 * 3600000);
  }

  function prefillDateTime() {
    const ist = getISTNow();
    const dateStr = ist.getFullYear() + '-' + String(ist.getMonth() + 1).padStart(2, '0') + '-' + String(ist.getDate()).padStart(2, '0');
    const timeStr = String(ist.getHours()).padStart(2, '0') + ':' + String(ist.getMinutes()).padStart(2, '0');
    const dateInput = document.getElementById('smokeDate');
    const timeInput = document.getElementById('smokeTime');
    if (dateInput) { dateInput.value = dateStr; dateInput.max = dateStr; }
    if (timeInput) timeInput.value = timeStr;
  }

  window.setDateTimeMode = function (mode) {
    dtMode = mode;
    const nowBtn = document.getElementById('dtNowBtn');
    const customBtn = document.getElementById('dtCustomBtn');
    const fields = document.getElementById('dtCustomFields');
    if (mode === 'now') {
      if (nowBtn) nowBtn.classList.add('dt-active');
      if (customBtn) customBtn.classList.remove('dt-active');
      if (fields) fields.style.display = 'none';
    } else {
      if (nowBtn) nowBtn.classList.remove('dt-active');
      if (customBtn) customBtn.classList.add('dt-active');
      if (fields) fields.style.display = 'block';
      prefillDateTime();
    }
  };

  window.quickTimeOffset = function (minutes) {
    dtMode = 'custom';
    const nowBtn = document.getElementById('dtNowBtn');
    const customBtn = document.getElementById('dtCustomBtn');
    const fields = document.getElementById('dtCustomFields');
    if (nowBtn) nowBtn.classList.remove('dt-active');
    if (customBtn) customBtn.classList.add('dt-active');
    if (fields) fields.style.display = 'block';

    const ist = getISTNow();
    ist.setMinutes(ist.getMinutes() - minutes);
    const dateStr = ist.getFullYear() + '-' + String(ist.getMonth() + 1).padStart(2, '0') + '-' + String(ist.getDate()).padStart(2, '0');
    const timeStr = String(ist.getHours()).padStart(2, '0') + ':' + String(ist.getMinutes()).padStart(2, '0');
    const dateInput = document.getElementById('smokeDate');
    const timeInput = document.getElementById('smokeTime');
    if (dateInput) dateInput.value = dateStr;
    if (timeInput) timeInput.value = timeStr;
  };

  // Expose modal functions globally
  window.openSmokeModal = function () {
    selectedTrigger = '';
    selectedMood = '';
    dtMode = 'now';
    document.querySelectorAll('.trigger-chip, .mood-chip').forEach(b => b.classList.remove('chip-active'));
    const noteInput = document.getElementById('smokeNote');
    if (noteInput) noteInput.value = '';
    // Reset date/time picker to "Abhi" mode
    const nowBtn = document.getElementById('dtNowBtn');
    const customBtn = document.getElementById('dtCustomBtn');
    const fields = document.getElementById('dtCustomFields');
    if (nowBtn) nowBtn.classList.add('dt-active');
    if (customBtn) customBtn.classList.remove('dt-active');
    if (fields) fields.style.display = 'none';
    prefillDateTime();
    const modal = document.getElementById('smokeModal');
    if (modal) { modal.style.display = 'flex'; setTimeout(() => modal.classList.add('modal-visible'), 10); }
  };

  window.closeSmokeModal = function () {
    const modal = document.getElementById('smokeModal');
    if (modal) { modal.classList.remove('modal-visible'); setTimeout(() => modal.style.display = 'none', 300); }
  };

  window.closeSmokeModalOutside = function (e) {
    if (e.target.id === 'smokeModal') window.closeSmokeModal();
  };

  window.confirmSmoke = async function () {
    const btnText = document.getElementById('smokeBtnText');
    const btnLoader = document.getElementById('smokeBtnLoader');
    const confirmBtn = document.getElementById('confirmSmokeBtn');
    if (btnText) btnText.style.display = 'none';
    if (btnLoader) btnLoader.style.display = 'inline';
    if (confirmBtn) confirmBtn.disabled = true;

    const note = (document.getElementById('smokeNote') || {}).value || '';

    // Build custom timestamp if in custom mode
    let customTimestamp = null;
    if (dtMode === 'custom') {
      const dateVal = (document.getElementById('smokeDate') || {}).value;
      const timeVal = (document.getElementById('smokeTime') || {}).value;
      if (dateVal && timeVal) {
        // Create IST timestamp string: YYYY-MM-DDTHH:MM:00+05:30
        customTimestamp = dateVal + 'T' + timeVal + ':00+05:30';
      }
    }

    try {
      const res = await fetch('/api/smoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: selectedTrigger, mood: selectedMood, note, customTimestamp })
      });
      const data = await res.json();

      if (data.success) {
        // Update dashboard elements
        const countEl = document.getElementById('todayCountDisplay');
        if (countEl) countEl.textContent = data.todayCount;

        // Update Today/Limit mini-stat
        const limitEl = document.getElementById('todayLimitDisplay');
        if (limitEl) limitEl.textContent = data.todayCount + '/' + data.dailyGoal;
        const limitIcon = document.getElementById('limitIcon');
        if (limitIcon) {
          if (data.todayCount < data.dailyGoal) {
            limitIcon.textContent = '✓'; limitIcon.style.color = 'var(--accent-green)';
          } else if (data.todayCount === data.dailyGoal) {
            limitIcon.textContent = '⚠'; limitIcon.style.color = 'var(--accent-yellow)';
          } else {
            limitIcon.textContent = '✗'; limitIcon.style.color = 'var(--accent-red)';
          }
        }

        const progressEl = document.getElementById('goalProgress');
        if (progressEl) {
          const pct = Math.min((data.todayCount / data.dailyGoal) * 100, 100);
          progressEl.style.width = pct + '%';
        }

        // Show AI feedback (loading state first, then Puter fills in)
        const feedbackPanel = document.getElementById('aiFeedbackPanel');
        const feedbackText = document.getElementById('aiFeedbackText');
        if (feedbackPanel && feedbackText) {
          feedbackText.innerHTML = '<span class="spinner-border spinner-border-sm text-info"></span> AI analyzing...';
          feedbackPanel.style.display = 'block';
          feedbackPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

          // Build prompt with all smoking context
          const overLimitNow = data.todayCount >= data.dailyGoal;
          const smokePrompt = `JUST SMOKED — cigarette #${data.todayCount}/${data.dailyGoal} today${overLimitNow ? ' (OVER LIMIT!)' : ''}.
Trigger: ${data.trigger || 'none'}. Mood: ${data.mood || 'none'}.
Weekly avg: ${data.weeklyAvg}/day. Trend: ${data.trend}. Peak hour: ${toAMPM(data.peakHour)}.
Gap since last: ${data.lastGapMinutes || '?'} min. Risk: ${data.risk.riskLevel} (${data.risk.score}/100).
${data.rapidRepeat ? 'RAPID REPEAT — 2 cigs within 60 min!' : ''}`;

          callPuterAI(
            `⚠️ STRICT RULES — TODHA BHI ENGLISH LIKHA TO FAIL:
1. SIRF Hinglish. Pure English = FAIL.
2. SIRF 1 line. Emoji + max 12 words. Koi heading/paragraph NAHI.
3. Koi "Based on", "I suggest" type English mat likh.

Format:
[emoji] [kya hua + pattern — Hinglish me]

Examples:
🔥 Stress se 3rd baar aaj — gap sirf 45 min raha
⚠️ Limit cross! ${data.dailyGoal} me se ${data.dailyGoal} — ruk ja ab
✅ 3 ghante ka gap — badhiya pace, aise hi rakh

Trigger/mood mention kar agar diya hai. 1 line, Hinglish, bas.`,
            smokePrompt
          ).then(advice => {
            feedbackText.innerHTML = formatAIText(advice);
          });
        }

        // Update timeline
        if (data.timeline) updateTimeline(data.timeline);

        // Reset craving timer
        if (window.__cravingInterval) clearInterval(window.__cravingInterval);
        window.__lastSmokeTime = new Date();
        startCravingTimer();

        // Show rapid repeat warning
        if (data.rapidRepeat) {
          showToast('⚠️ Rapid repeat! Two cigarettes within 60 minutes.');
        }

        // Close modal
        window.closeSmokeModal();
      }
    } catch (err) {
      console.error('Smoke log error:', err);
      showToast('Failed to log. Check connection.');
    } finally {
      if (btnText) btnText.style.display = 'inline';
      if (btnLoader) btnLoader.style.display = 'none';
      if (confirmBtn) confirmBtn.disabled = false;
    }
  };

  // ── Update timeline dynamically ──
  function updateTimeline(timeline) {
    const wrap = document.getElementById('timelineWrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    timeline.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'timeline-entry';
      div.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <span class="timeline-time">${entry.time}</span>
          ${entry.trigger ? `<span class="timeline-tag trigger-tag">${entry.trigger}</span>` : ''}
          ${entry.mood ? `<span class="timeline-tag mood-tag">${entry.mood}</span>` : ''}
        </div>
      `;
      wrap.appendChild(div);
    });
    // Ensure the timeline card is visible
    const card = wrap.closest('.glass-card');
    if (card) card.style.display = 'block';
  }

  // ── Toast notification ──
  function showToast(msg) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('toast-show');
    setTimeout(() => toast.classList.remove('toast-show'), 4000);
  }

  // ── Craving timer (live update) ──
  function startCravingTimer() {
    const el = document.getElementById('cravingTimer');
    if (!el) return;
    const startTime = window.__lastSmokeTime || (window.__lastMinutesAgo !== null ? new Date(Date.now() - window.__lastMinutesAgo * 60000) : null);
    if (!startTime) return;

    function update() {
      const diff = Math.floor((Date.now() - startTime.getTime()) / 60000);
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      el.textContent = (hrs > 0 ? hrs + 'h ' : '') + mins + 'm';
    }
    update();
    window.__cravingInterval = setInterval(update, 60000);
  }

  if (window.__lastMinutesAgo !== null && window.__lastMinutesAgo !== undefined) {
    window.__lastSmokeTime = new Date(Date.now() - window.__lastMinutesAgo * 60000);
    startCravingTimer();
  }

  // ══════════════════════════════════════
  // ── DASHBOARD AI ADVICE (auto-load) ──
  // ══════════════════════════════════════
  if (window.__dashboardData) {
    const d = window.__dashboardData;
    const loader = document.getElementById('dashboardAILoader');
    const textEl = document.getElementById('dashboardAIText');

    // Build rich pattern context
    const overLimit = d.todayCount >= d.dailyGoal;
    const pct = d.dailyGoal > 0 ? Math.round((d.todayCount / d.dailyGoal) * 100) : 0;
    const gapInfo = d.avgGap ? `Avg gap between cigs: ${d.avgGap} min` : 'Gap data unavailable';

    const dashPrompt = `USER'S REAL-TIME SMOKING DATA:
• Today: ${d.todayCount}/${d.dailyGoal} cigarettes (${pct}% of limit)${overLimit ? ' — OVER LIMIT!' : ''}
• Weekly avg: ${d.weeklyAvg}/day | Trend: ${d.trend}
• Peak hour: ${toAMPM(d.peakHour)} | ${gapInfo}
• Risk: ${d.riskScore}/100 (${d.riskLevel})
• Streak under limit: ${d.streak.currentStreak} days
• Yesterday: ${d.streak.yesterdayCount} cigs
${d.flags && d.flags.length > 0 ? '• Flags: ' + d.flags.join(', ') : ''}
Abhi ka time: ${new Date().toLocaleTimeString('en-IN', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', hour12:true})}`;

    callPuterAI(
      `⚠️ STRICT RULES — TODHA BHI ENGLISH LIKHA TO FAIL:
1. SIRF Hinglish. Pure English = FAIL.
2. SIRF 1 line. Emoji + max 12 words. Koi heading/paragraph NAHI.
3. Koi "Based on", "Your data shows" type English mat likh.

Format:
[emoji] [pattern] — [tip]

Examples:
🕐 ${toAMPM(d.peakHour)} pe sabse zyada peeta hai — walk pe ja
📉 Hafte me 30% kam hua — gap aur badhao
⚠️ Aaj limit cross — ab ruk ja bhai

Exact numbers data se utha. 1 line, Hinglish, bas.`,
      dashPrompt
    ).then(advice => {
      if (loader) loader.style.display = 'none';
      if (textEl) {
        textEl.style.display = 'block';
        const p = textEl.querySelector('.ai-text');
        if (p) p.innerHTML = formatAIText(advice);
      }
    });
  }

  // ══════════════════════════════════════
  // ── ANALYTICS AI INSIGHT (Puter.js) ──
  // ══════════════════════════════════════
  window.loadAnalyticsAI = async function () {
    const loader = document.getElementById('aiAnalyticsLoader');
    const text = document.getElementById('aiAnalyticsText');
    const btn = document.getElementById('refreshAIBtn');
    if (loader) loader.style.display = 'block';
    if (text) text.style.display = 'none';
    if (btn) btn.disabled = true;
    try {
      // Fetch raw analytics data from server
      const res = await fetch('/api/analytics/ai');
      const d = await res.json();

      if (d.insight) {
        // Server returned an error message
        if (text) {
          const p = text.querySelector('.ai-text');
          if (p) p.innerHTML = formatAIText(d.insight);
          text.style.display = 'block';
        }
        return;
      }

      const analyticsPrompt = `DATA:
Avg: ${d.weeklyAvg}/day | Peak: ${toAMPM(d.peakHour)} | Trend: ${d.trend}
Triggers: ${d.topTriggers || 'none'} | Moods: ${d.topMoods || 'none'}
7 days: ${d.dailySummary}
Gap: ${d.avgGap || '?'} min | Total: ${d.totalLifetime}
${d.hourlyBreakdown ? 'Hours: ' + d.hourlyBreakdown : ''}`;

      const insight = await callPuterAI(
        `⚠️ STRICT RULES — TODHA BHI ENGLISH LIKHA TO FAIL:
1. SIRF Hinglish (Hindi words English script me). Pure English = FAIL.
2. SIRF 3 lines. Har line me emoji + max 10 words. Koi heading, paragraph, bullet, explanation NAHI.
3. Koi "Based on", "Here is", "Interpretation", "Recommendation" type English mat likh.

Format (exactly copy kar, sirf numbers/words change kar):
🕐 [X AM/PM] tera peak time — yahi danger zone
🔥 [trigger] se sabse zyada craving — [X] baar
📊 [deep pattern insight — jaise gap trend, kab zyada peeta, kaunsa din heavy]

3rd line me SIRF pattern/analysis likho. Koi suggestion/tip/exercise/bahar niklo type bakwas NAHI. Sirf data se pattern nikalo.

Example output:
🕐 1PM tera peak time — yahi danger zone
🔥 habit se sabse zyada craving — 2 baar
📊 weekend pe 2x zyada peeta hai weekday se

Bas itna hi likho. 3 lines. Koi aur text mat do.`,
        analyticsPrompt
      );
      if (text) {
        const p = text.querySelector('.ai-text');
        if (p) p.innerHTML = formatAIText(insight);
        text.style.display = 'block';
      }
    } catch (err) {
      if (text) {
        const p = text.querySelector('.ai-text');
        if (p) p.innerHTML = formatAIText('Failed to load insight.');
        text.style.display = 'block';
      }
    } finally {
      if (loader) loader.style.display = 'none';
      if (btn) btn.disabled = false;
    }
  };

  // Ripple animation
  const style = document.createElement('style');
  style.textContent = '@keyframes ripple { to { transform: scale(10); opacity: 0; } }';
  document.head.appendChild(style);

  // ══════════════════════════════════════
  // ── SCROLL REVEAL ANIMATION ──
  // ══════════════════════════════════════
  const revealEls = document.querySelectorAll('.scroll-reveal');
  if (revealEls.length > 0) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => revealObserver.observe(el));
  }

  // ══════════════════════════════════════
  // ── TILT CARD 3D EFFECT ──
  // ══════════════════════════════════════
  document.querySelectorAll('.tilt-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -4;
      const rotateY = ((x - centerX) / centerX) * 4;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // ══════════════════════════════════════
  // ── COUNT-UP ANIMATION ──
  // ══════════════════════════════════════
  document.querySelectorAll('.stat-value').forEach(el => {
    const target = parseFloat(el.textContent);
    if (isNaN(target)) return;
    const isDecimal = el.textContent.includes('.');
    const duration = 600;
    const start = Date.now();
    const initial = 0;
    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = initial + (target - initial) * eased;
      el.textContent = isDecimal ? current.toFixed(1) : Math.round(current);
      if (progress < 1) requestAnimationFrame(tick);
    }
    tick();
  });
});
