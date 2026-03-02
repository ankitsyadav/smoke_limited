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
    daily: { trend: 'Last 7 Days' },
    weekly: { trend: 'Last 12 Weeks' },
    monthly: { trend: 'Last 12 Months' },
    yearly: { trend: 'Last 5 Years' }
  };

  let trendChart = null, dayOfWeekChart = null, triggerChartObj = null, moodChartObj = null, weeklyChart = null;

  // ══════════════════════════════════════
  // ── PUTER.JS AI HELPER (FREE GPT) ──
  // ══════════════════════════════════════

  // Auth state tracking
  let _puterAuthed = false;
  let _puterSkipped = sessionStorage.getItem('puterSkipped') === 'true';

  function isPuterAuthed() {
    if (_puterAuthed) return true;
    try {
      if (typeof puter !== 'undefined' && puter.auth && typeof puter.auth.isSignedIn === 'function') {
        _puterAuthed = puter.auth.isSignedIn();
        return _puterAuthed;
      }
    } catch (e) {}
    return false;
  }

  // Attempt Puter sign-in; resolves true on success, false on cancel/error
  async function doPuterSignIn() {
    try {
      if (typeof puter !== 'undefined' && puter.auth && puter.auth.signIn) {
        await puter.auth.signIn();
        _puterAuthed = true;
        _puterSkipped = false;
        sessionStorage.removeItem('puterSkipped');
        return true;
      }
    } catch (e) {
      console.warn('[PuterAuth] Sign-in cancelled or failed', e);
    }
    return false;
  }

  function markPuterSkipped() {
    _puterSkipped = true;
    sessionStorage.setItem('puterSkipped', 'true');
  }

  // ── Full CTA: shimmer preview + heading + features + button ──
  function renderAIConsentCTA(targetEl, opts) {
    if (!targetEl) return;
    const compact = opts && opts.compact;
    const onDone = opts && opts.onAuthed; // callback after successful auth

    const wrap = document.createElement('div');
    wrap.className = compact ? 'ai-consent-compact' : 'ai-consent-wrap';

    if (!compact) {
      // Shimmer preview lines
      wrap.innerHTML += `
        <div class="ai-consent-preview">
          <div class="ai-consent-line"></div>
          <div class="ai-consent-line"></div>
          <div class="ai-consent-line"></div>
        </div>`;
    }

    wrap.innerHTML += `
      <div class="ai-consent-heading">
        <i class="bi bi-stars"></i> ${compact ? 'AI ne kuch dekha hai' : 'Get Your AI Insights'}
      </div>`;

    if (!compact) {
      wrap.innerHTML += `
        <div class="ai-consent-features">
          <span class="ai-consent-feature">🧠 Smart Pattern Detection</span>
          <span class="ai-consent-feature">💡 Personalized Tips</span>
          <span class="ai-consent-feature">📊 Risk Analysis</span>
        </div>`;
    }

    const btn = document.createElement('button');
    btn.className = 'ai-consent-btn';
    btn.innerHTML = '<i class="bi bi-unlock"></i> Enable AI Insights';
    btn.onclick = async function () {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Connecting...';
      const ok = await doPuterSignIn();
      if (ok) {
        wrap.classList.add('ai-consent-fadeout');
        setTimeout(() => {
          wrap.remove();
          if (onDone) onDone();
        }, 300);
      } else {
        // User cancelled Puter popup
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-unlock"></i> Enable AI Insights';
        showToast('No worries! AI available anytime 🤖');
        markPuterSkipped();
        renderAIMiniPill(targetEl);
        wrap.classList.add('ai-consent-fadeout');
        setTimeout(() => wrap.remove(), 300);
      }
    };
    wrap.appendChild(btn);

    // Skip link
    const skip = document.createElement('button');
    skip.className = 'ai-consent-skip';
    skip.textContent = 'Not Now';
    skip.onclick = function () {
      markPuterSkipped();
      wrap.classList.add('ai-consent-fadeout');
      setTimeout(() => {
        wrap.remove();
        renderAIMiniPill(targetEl);
      }, 300);
    };
    wrap.appendChild(skip);

    targetEl.innerHTML = '';
    targetEl.style.display = 'block';
    targetEl.appendChild(wrap);
  }

  // ── Mini pill: collapsed state for after-skip ──
  function renderAIMiniPill(targetEl) {
    if (!targetEl) return;
    const pill = document.createElement('div');
    pill.className = 'ai-consent-mini';
    pill.innerHTML = '<i class="bi bi-robot"></i> AI Insights Available';
    pill.onclick = function () {
      pill.remove();
      // Re-open full CTA
      _puterSkipped = false;
      sessionStorage.removeItem('puterSkipped');
      renderAIConsentCTA(targetEl, { onAuthed: targetEl._aiRetryFn });
    };
    targetEl.innerHTML = '';
    targetEl.style.display = 'block';
    targetEl.appendChild(pill);
  }

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
  function showChartEmpty(canvasId, wrapId, msg) {
    const canvas = document.getElementById(canvasId);
    if (canvas) canvas.style.display = 'none';
    const wrap = wrapId ? document.getElementById(wrapId) : (canvas ? canvas.parentElement : null);
    if (wrap) wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:80px;color:var(--text-muted);font-size:0.8rem;text-align:center;padding:20px;opacity:0.65;flex-direction:column;gap:6px"><span style="font-size:1.5rem">📊</span><span>' + msg + '</span></div>';
  }

  function buildTrendChart(data) {
    const ctx = document.getElementById('dailyChart');
    if (!ctx) return;
    if (trendChart) trendChart.destroy();
    const goal = window.__dailyGoal || 5;
    const counts = data.map(d => d.count);
    if (counts.every(c => c === 0)) { showChartEmpty('dailyChart', 'dailyChartWrap', 'Start logging to see your daily trend'); return; }

    // Calculate % reduction vs previous period (last half vs first half)
    const mid = Math.floor(counts.length / 2);
    const firstHalf = counts.slice(0, mid);
    const secondHalf = counts.slice(mid);
    const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
    const pctChange = avgFirst > 0 ? Math.round(((avgSecond - avgFirst) / avgFirst) * 100) : 0;

    const badge = document.getElementById('trendBadge');
    if (badge) {
      if (pctChange < 0) {
        badge.textContent = `🟢 ${Math.abs(pctChange)}% kam vs last week`;
        badge.style.background = 'rgba(107,255,107,0.15)';
        badge.style.color = '#6bff6b';
      } else if (pctChange > 0) {
        badge.textContent = `🔴 +${pctChange}% badha vs last week`;
        badge.style.background = 'rgba(255,107,107,0.15)';
        badge.style.color = '#ff6b6b';
      } else {
        badge.textContent = `🟡 Same as last week`;
        badge.style.background = 'rgba(255,217,61,0.15)';
        badge.style.color = '#ffd93d';
      }
    }

    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.date),
        datasets: [
          {
            label: 'Cigarettes',
            data: counts,
            borderColor: olive, backgroundColor: 'rgba(107, 143, 113, 0.15)',
            borderWidth: 2.5, fill: true, tension: 0.4,
            pointBackgroundColor: oliveLight, pointBorderColor: oliveDark,
            pointRadius: data.length > 20 ? 2 : 5, pointHoverRadius: 8,
            pointHoverBackgroundColor: '#fff', pointHoverBorderColor: olive, pointHoverBorderWidth: 3
          },
          {
            label: 'Target',
            data: Array(data.length).fill(goal),
            borderColor: '#ff6b6b', borderWidth: 2, borderDash: [8, 4],
            pointRadius: 0, fill: false, tension: 0
          }
        ]
      },
      options: {
        ...chartDefaults,
        plugins: { legend: { display: false } },
        scales: {
          ...chartDefaults.scales,
          y: {
            ...chartDefaults.scales.y,
            ticks: { ...chartDefaults.scales.y.ticks, stepSize: 1, callback: v => Number.isInteger(v) ? v : '' }
          }
        }
      }
    });
  }

  function buildWeeklyChart(data) {
    const ctx = document.getElementById('weeklyChart');
    if (!ctx) return;
    if (weeklyChart) weeklyChart.destroy();

    const counts = data.map(d => d.count);
    const labels = data.map(d => d.date);
    if (counts.every(c => c === 0)) { showChartEmpty('weeklyChart', null, 'Log on multiple weeks to see comparison'); return; }

    // Calculate % change between consecutive weeks
    const changeLabels = data.map((d, i) => {
      if (i === 0) return '';
      const prev = counts[i - 1];
      if (prev === 0) return counts[i] > 0 ? '+∞' : '0%';
      const pct = Math.round(((counts[i] - prev) / prev) * 100);
      return pct > 0 ? `+${pct}%` : `${pct}%`;
    });

    // Color bars based on trend
    const colors = data.map((d, i) => {
      if (i === 0) return 'rgba(107, 143, 113, 0.7)';
      return counts[i] <= counts[i - 1] ? 'rgba(107, 255, 107, 0.6)' : 'rgba(255, 107, 107, 0.6)';
    });

    weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace(/[\d.]+\)$/, '1)')),
          borderWidth: 1, borderRadius: 8, borderSkipped: false
        }]
      },
      options: {
        ...chartDefaults,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => changeLabels[ctx.dataIndex] ? `Change: ${changeLabels[ctx.dataIndex]}` : ''
            }
          }
        },
        scales: {
          ...chartDefaults.scales,
          y: { ...chartDefaults.scales.y, ticks: { ...chartDefaults.scales.y.ticks, stepSize: 1, callback: v => Number.isInteger(v) ? v : '' } }
        }
      }
    });

    // Show change label
    const changeEl = document.getElementById('weeklyChangeLabel');
    if (changeEl && counts.length >= 2) {
      const last = counts[counts.length - 1];
      const prev = counts[counts.length - 2];
      const pct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
      if (pct < 0) {
        changeEl.innerHTML = `<span style="color:#6bff6b;">🟢 ${Math.abs(pct)}% kam pichle hafte se</span>`;
      } else if (pct > 0) {
        changeEl.innerHTML = `<span style="color:#ff6b6b;">🔴 +${pct}% relapse spike</span>`;
      } else {
        changeEl.innerHTML = `<span style="color:#ffd93d;">🟡 Same as last week</span>`;
      }
    }
  }

  function buildHeatmap(data) {
    const wrap = document.getElementById('heatmapWrap');
    if (!wrap) return;
    if (!data || data.every(v => v === 0)) {
      wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:80px;color:var(--text-muted);font-size:0.8rem;text-align:center;opacity:0.65;">Log at different times to see your peak hours</div>';
      return;
    }
    const maxVal = Math.max(...data, 1);

    // Show 6AM to 12AM (18 hours) — most relevant
    const startHr = 6, endHr = 24;
    let html = '<div class="heatmap-grid">';

    for (let h = startHr; h < endHr; h++) {
      const count = data[h] || 0;
      const ratio = count / maxVal;
      let bg, textColor;
      if (count === 0) {
        bg = 'rgba(107, 143, 113, 0.08)';
        textColor = '#555';
      } else if (ratio > 0.7) {
        bg = `rgba(255, 70, 70, ${0.5 + ratio * 0.4})`;
        textColor = '#fff';
      } else if (ratio > 0.3) {
        bg = `rgba(255, 200, 50, ${0.3 + ratio * 0.4})`;
        textColor = '#1a1a2e';
      } else {
        bg = `rgba(107, 200, 113, ${0.2 + ratio * 0.3})`;
        textColor = '#e0e0e0';
      }

      const ampm = h >= 12 ? (h === 12 ? '12P' : (h - 12) + 'P') : (h === 0 ? '12A' : h + 'A');
      html += `<div class="heatmap-cell" style="background:${bg};color:${textColor};" title="${ampm}: ${count} cigs">
        <div class="hm-hour">${ampm}</div>
        <div class="hm-count">${count}</div>
      </div>`;
    }
    html += '</div>';
    wrap.innerHTML = html;
  }

  function buildDayOfWeekChart(data) {
    const ctx = document.getElementById('dayOfWeekChart');
    if (!ctx) return;
    if (dayOfWeekChart) dayOfWeekChart.destroy();
    const labels = data.map(d => d.day);
    const avgs = data.map(d => d.avg);
    const maxAvg = Math.max(...avgs);
    if (maxAvg === 0) { showChartEmpty('dayOfWeekChart', 'dayOfWeekWrap', 'Log on different days to see which day is heaviest'); return; }
    const heavyIdx = avgs.indexOf(maxAvg);
    const colors = avgs.map((v, i) => {
      if (i === heavyIdx && v > 0) return 'rgba(255, 107, 107, 0.85)';
      const ratio = maxAvg > 0 ? v / maxAvg : 0;
      if (ratio > 0.7) return 'rgba(255, 217, 61, 0.75)';
      return 'rgba(107, 143, 113, 0.6)';
    });
    const badge = document.getElementById('heavyDayBadge');
    if (badge && maxAvg > 0) {
      badge.textContent = '🔥 ' + labels[heavyIdx] + ' sabse heavy';
      badge.style.background = 'rgba(255,107,107,0.2)';
      badge.style.color = '#ff6b6b';
    }
    dayOfWeekChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels, datasets: [{
          label: 'Avg / day',
          data: avgs,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace(/[\d.]+\)$/, '1)')),
          borderWidth: 1, borderRadius: 8, borderSkipped: false
        }]
      },
      options: {
        ...chartDefaults,
        scales: {
          ...chartDefaults.scales,
          x: { ...chartDefaults.scales.x, ticks: { color: tickColor, font: { size: 10 } } },
          y: { ...chartDefaults.scales.y, title: { display: true, text: 'Avg cigarettes', color: tickColor, font: { size: 9 } } }
        },
        plugins: {
          ...chartDefaults.plugins,
          tooltip: {
            callbacks: {
              label: function(ctx) { return 'Avg: ' + ctx.parsed.y.toFixed(1) + ' / day'; }
            }
          }
        }
      }
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
  if (window.__hourly) buildHeatmap(window.__hourly);
  if (window.__dayOfWeek) buildDayOfWeekChart(window.__dayOfWeek);
  if (window.__weekly4) buildWeeklyChart(window.__weekly4);

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
        if (tt) tt.textContent = t.trend;
        buildTrendChart(data.trendData);
        buildHeatmap(data.hourly);
        if (data.weekly4) buildWeeklyChart(data.weekly4);
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

        const progressEl = null; // health timer replaces progress bar
        if (progressEl) {
          const pct = Math.min((data.todayCount / data.dailyGoal) * 100, 100);
          progressEl.style.width = pct + '%';
        }

        // Show AI feedback (loading state first, then Puter fills in)
        const feedbackPanel = document.getElementById('aiFeedbackPanel');
        const feedbackText = document.getElementById('aiFeedbackText');
        if (feedbackPanel && feedbackText) {
          feedbackPanel.style.display = 'block';
          feedbackPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

          // Build prompt with all smoking context
          const overLimitNow = data.todayCount >= data.dailyGoal;
          const smokePrompt = `JUST SMOKED — cigarette #${data.todayCount}/${data.dailyGoal} today${overLimitNow ? ' (OVER LIMIT!)' : ''}.
Trigger: ${data.trigger || 'none'}. Mood: ${data.mood || 'none'}.
Weekly avg: ${data.weeklyAvg}/day. Trend: ${data.trend}. Peak hour: ${toAMPM(data.peakHour)}.
Gap since last: ${data.lastGapMinutes || '?'} min. Risk: ${data.risk.riskLevel} (${data.risk.score}/100).
${data.rapidRepeat ? 'RAPID REPEAT — 2 cigs within 60 min!' : ''}`;

          const doSmokeFeedback = function () {
            feedbackText.innerHTML = '<span class="spinner-border spinner-border-sm text-info"></span> AI analyzing...';
            // Deterministic: build the exact fact + improvement for AI to rephrase
            const overNow = data.todayCount > data.dailyGoal;
            const atLimit = data.todayCount === data.dailyGoal;
            const gapMin = data.lastGapMinutes || '?';
            const cost = data.costPerCigarette || 15;
            let smokeFact, smokeImprove, smokeTone;

            if (data.rapidRepeat) {
              smokeFact = `${gapMin} min me phir se — chain smoking ho rha`;
              smokeImprove = 'Kam se kam 1 ghanta ruk next se pehle';
              smokeTone = 'tough';
            } else if (overNow) {
              smokeFact = `Limit cross — ${data.todayCount}/${data.dailyGoal}, ${data.todayCount - data.dailyGoal} extra`;
              smokeImprove = 'Ab aaj bilkul STOP. Ek aur nahi.';
              smokeTone = 'tough';
            } else if (atLimit) {
              smokeFact = `Limit touch — ${data.todayCount}/${data.dailyGoal} ho gaye`;
              smokeImprove = `Ab ek bhi aur nahi — ₹${cost} aur 11 min zindagi bachega`;
              smokeTone = 'firm';
            } else {
              smokeFact = `Cigarette #${data.todayCount}/${data.dailyGoal}` + (data.trigger ? ` (${data.trigger})` : '') + ` — gap ${gapMin} min`;
              smokeImprove = `${data.dailyGoal - data.todayCount} aur allowed — next ka gap badhao`;
              smokeTone = 'firm';
            }

            callPuterAI(
              `⚠️ STRICT RULES:
1. SIRF Hinglish. Pure English = FAIL.
2. EXACTLY 1 line. Max 18 words. Emoji se start kar.
3. Neeche diya hua FACT aur IMPROVEMENT apne words me bol. Naya mat soch.
4. ${smokeTone === 'tough' ? 'DANT laga. Gussa dikhao.' : 'Seedha bol, no diplomacy.'}

Format: [emoji] [fact] — [improvement]`,
              `FACT: ${smokeFact}\nIMPROVEMENT: ${smokeImprove}\nTONE: ${smokeTone}`
            ).then(advice => {
              feedbackText.innerHTML = formatAIText(advice);
            });
          };

          if (isPuterAuthed()) {
            doSmokeFeedback();
          } else if (_puterSkipped) {
            // Re-offer after smoke (contextual moment) — compact CTA
            feedbackText._aiRetryFn = doSmokeFeedback;
            renderAIConsentCTA(feedbackText, { compact: true, onAuthed: doSmokeFeedback });
          } else {
            // First time — full CTA in feedback panel
            feedbackText._aiRetryFn = doSmokeFeedback;
            renderAIConsentCTA(feedbackText, { onAuthed: doSmokeFeedback });
          }
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

  // ── Craving timer (live update) + Health Recovery milestones ──
  function startCravingTimer() {
    const el = document.getElementById('cravingTimer');
    const healthEl = document.getElementById('healthTimerDisplay');
    const startTime = window.__lastSmokeTime || (window.__lastMinutesAgo !== null ? new Date(Date.now() - window.__lastMinutesAgo * 60000) : null);
    if (!startTime) return;

    function update() {
      const diff = Math.floor((Date.now() - startTime.getTime()) / 60000);
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      const timeStr = (hrs > 0 ? hrs + 'h ' : '') + mins + 'm';

      if (el) el.textContent = timeStr;

      // Update health timer display
      if (healthEl) {
        healthEl.innerHTML = '<i class="bi bi-heart-pulse" style="font-size:1.1rem;"></i> ' + timeStr + ' smoke-free';
      }

      // Update health milestones
      const milestones = document.querySelectorAll('.health-ms');
      milestones.forEach(ms => {
        const minReq = parseInt(ms.getAttribute('data-min'), 10);
        if (diff >= minReq) {
          ms.classList.remove('health-ms-locked');
          ms.classList.add('health-ms-done');
        } else {
          ms.classList.remove('health-ms-done');
          ms.classList.add('health-ms-locked');
        }
      });
    }
    update();
    window.__cravingInterval = setInterval(update, 30000);
  }

  if (window.__lastMinutesAgo !== null && window.__lastMinutesAgo !== undefined) {
    window.__lastSmokeTime = new Date(Date.now() - window.__lastMinutesAgo * 60000);
    startCravingTimer();
  }

  // ══════════════════════════════════════
  // ── SCORE BREAKDOWN ACCORDION ──
  // ══════════════════════════════════════
  window.toggleBreakdown = function () {
    const d = document.getElementById('breakdownDetail');
    const b = document.getElementById('breakdownToggle');
    if (!d || !b) return;
    const open = d.style.display !== 'none';
    d.style.display = open ? 'none' : 'block';
    b.textContent = open ? '▾ Score ka breakdown dekho' : '▴ Band karo';
  };

  window.toggleBreakdownAnalytics = function () {
    const d = document.getElementById('breakdownDetailAnalytics');
    const b = document.getElementById('breakdownToggleAnalytics');
    if (!d || !b) return;
    const open = d.style.display !== 'none';
    d.style.display = open ? 'none' : 'block';
    b.textContent = open ? '▾ Score ka breakdown dekho' : '▴ Band karo';
  };

  // ══════════════════════════════════════
  // ── DASHBOARD AI ADVICE (auto-load) ──
  // ══════════════════════════════════════

  // ── State machine: deterministically pick what AI should say ──
  function pickAdviceContext(d) {
    const gap = d.lastMinutesAgo;
    const gapHrs = gap !== null ? Math.floor(gap / 60) : null;
    const gapMins = gap !== null ? gap % 60 : null;
    const gapStr = gap !== null ? (gapHrs > 0 ? gapHrs + 'h ' + gapMins + 'm' : gapMins + ' min') : null;
    const cost = d.costPerCigarette || 15;
    const lifeLostMin = d.totalLifetime ? d.totalLifetime * 11 : 0;
    const lifeLostHrs = Math.round(lifeLostMin / 60);

    // SITUATION: What state is the user in right now?
    let situation, keyFact, improvement, tone;

    if (d.todayCount === 0 && gap !== null && gap >= 240) {
      situation = 'CHAMPION';
      keyFact = `${gapStr} se nahi pee — aaj bilkul clean`;
      improvement = 'Aise hi rakh, har minute body recover kar rhi hai';
      tone = 'encouraging';
    } else if (d.todayCount === 0) {
      situation = 'CLEAN_SLATE';
      keyFact = gap !== null ? `${gapStr} ho gaye bina peeve` : 'Aaj abhi tak ek bhi nahi';
      improvement = 'Mat pee — sahi ja rha hai, streak mat tod';
      tone = 'encouraging';
    } else if (d.todayCount > d.dailyGoal) {
      situation = 'OVER_LIMIT';
      const overBy = d.todayCount - d.dailyGoal;
      keyFact = `Limit cross — ${d.todayCount}/${d.dailyGoal}, ${overBy} extra pi li aaj`;
      improvement = d.consecutiveBreach > 1
        ? `${d.consecutiveBreach} din se lagatar over — control kar bhai`
        : 'Ab bilkul STOP. Ek aur mat pee aaj';
      tone = 'tough';
    } else if (d.todayCount === d.dailyGoal) {
      situation = 'AT_LIMIT';
      keyFact = `Limit pe — ${d.todayCount}/${d.dailyGoal} ho gaye`;
      improvement = 'Ab aur ek bhi nahi — ₹' + cost + ' aur 11 min zindagi bachega';
      tone = 'firm';
    } else if (gap !== null && gap < 30 && d.todayCount > 1) {
      situation = 'CHAIN_SMOKING';
      keyFact = `Sirf ${gapMins} min me phir se pi li — chain ho raha hai`;
      improvement = 'Kam se kam 1 ghanta gap rakh next ke liye';
      tone = 'tough';
    } else if (gap !== null && gap >= 120) {
      situation = 'RESISTING_LONG';
      keyFact = `${gapStr} ho gaye — body recover kar rhi hai`;
      improvement = d.todayCount < d.dailyGoal
        ? `Sirf ${d.dailyGoal - d.todayCount} aur allowed — gap badhata reh`
        : 'Mat pee, nicotine ki craving 3-5 min me chali jaegi';
      tone = 'encouraging';
    } else if (gap !== null && gap >= 60) {
      situation = 'RESISTING_GOOD';
      keyFact = `1 ghanta+ ho gaya — badhiya gap hai`;
      improvement = 'Aur thoda rok — har minute me craving kamzor hoti hai';
      tone = 'encouraging';
    } else {
      situation = 'RECENTLY_SMOKED';
      keyFact = gap !== null ? `${gapStr} pehle pi thi — ${d.todayCount}/${d.dailyGoal} aaj` : `${d.todayCount}/${d.dailyGoal} aaj`;
      if (d.gapTrend && d.gapTrend.changePercent < -20) {
        improvement = `Gap chhota hota ja rha — avg ${d.gapTrend.previousAvgGap}→${d.gapTrend.currentAvgGap} min, badha isko`;
      } else if (d.triggerTimePatterns && d.triggerTimePatterns.length > 0) {
        const ttp = d.triggerTimePatterns[0];
        improvement = `"${ttp.combo}" pattern ${ttp.percentage}% baar — ye time aur trigger se bach`;
      } else if (d.triggerBreakdown && d.triggerBreakdown.dominant) {
        improvement = `"${d.triggerBreakdown.dominant}" teri kamzori hai — isse bach`;
      } else {
        improvement = 'Next ek skip kar — ₹' + cost + ' bachega, 11 min zindagi badhegi';
      }
      tone = 'firm';
    }

    // Enrich with craving proximity warning
    if (d.nextCraving && d.nextCraving.minutesUntil !== null && d.nextCraving.minutesUntil < 30 && d.nextCraving.confidence > 40) {
      improvement += ` (⚡ ${d.nextCraving.minutesUntil} min me craving aayegi — ready reh)`;
    }

    return { situation, keyFact, improvement, tone };
  }

  // Extracted dashboard AI loader so it can be re-called after auth
  function loadDashboardAI() {
    const d = window.__dashboardData;
    if (!d) return;
    const loader = document.getElementById('dashboardAILoader');
    const textEl = document.getElementById('dashboardAIText');

    if (loader) { loader.style.display = 'block'; }
    if (textEl) { textEl.style.display = 'none'; }

    // Use deterministic state to constrain AI
    const ctx = pickAdviceContext(d);
    const toneMap = {
      tough: 'Tu ek strict bhai hai. DANT laga. No mercy. Roka nahi toh bigdega.',
      firm: 'Tu serious coach hai. Seedha bol, koi diplomacy nahi.',
      encouraging: 'Tu supportive bhai hai. Tareef kar, hausla badha. Mat peene ko bol.'
    };

    callPuterAI(
      `⚠️ STRICT RULES:
1. SIRF Hinglish (Hindi in English script). Pure English = FAIL.
2. EXACTLY 1 line. Max 18 words. Emoji se start kar.
3. Koi "Based on", "I recommend" type English NAHI.
4. Neeche jo FACT aur IMPROVEMENT diya hai, WOHI bol apne words me. Naya kuch invent mat kar.
5. ${toneMap[ctx.tone] || toneMap.firm}

Output format: [emoji] [rephrased fact] — [rephrased improvement]

Examples:
💪 2 ghante se nahi pee — sahi ja rha hai, mat tod
🔥 Limit cross 4/3 — ab STOP, ek aur nahi
⏱️ 45 min ka gap — chhota hai, 1 ghanta target rakh`,
      `FACT: ${ctx.keyFact}\nIMPROVEMENT: ${ctx.improvement}\nTONE: ${ctx.tone}\nSITUATION: ${ctx.situation}`
    ).then(advice => {
      if (loader) loader.style.display = 'none';
      if (textEl) {
        textEl.style.display = 'block';
        const p = textEl.querySelector('.ai-text');
        if (p) p.innerHTML = formatAIText(advice);
      }
    });
  }

  // Dashboard AI: gate with auth check
  if (window.__dashboardData) {
    const loader = document.getElementById('dashboardAILoader');
    const textEl = document.getElementById('dashboardAIText');

    if (isPuterAuthed()) {
      // Already authed → load AI immediately
      loadDashboardAI();
    } else if (_puterSkipped) {
      // User previously skipped → show mini pill
      if (loader) loader.style.display = 'none';
      if (textEl) {
        textEl._aiRetryFn = loadDashboardAI;
        renderAIMiniPill(textEl);
      }
    } else {
      // First time → show full CTA
      if (loader) loader.style.display = 'none';
      if (textEl) {
        textEl._aiRetryFn = loadDashboardAI;
        renderAIConsentCTA(textEl, { onAuthed: loadDashboardAI });
      }
    }
  }

  // ══════════════════════════════════════
  // ── ANALYTICS AI INSIGHT (Puter.js) ──
  // ══════════════════════════════════════
  window.loadAnalyticsAI = async function () {
    const loader = document.getElementById('aiAnalyticsLoader');
    const text = document.getElementById('aiAnalyticsText');
    const btn = document.getElementById('refreshAIBtn');

    // Auth gate for analytics AI
    if (!isPuterAuthed()) {
      if (loader) loader.style.display = 'none';
      if (btn) btn.disabled = false;
      if (text) {
        text._aiRetryFn = window.loadAnalyticsAI;
        if (_puterSkipped) {
          renderAIConsentCTA(text, { compact: true, onAuthed: window.loadAnalyticsAI });
        } else {
          renderAIConsentCTA(text, { onAuthed: window.loadAnalyticsAI });
        }
      }
      return;
    }

    if (loader) loader.style.display = 'block';
    if (text) text.style.display = 'none';
    if (btn) btn.disabled = true;

    // Helper: ensure .ai-text child exists (may have been replaced by auth CTA)
    function ensureAITextChild() {
      if (!text) return null;
      let p = text.querySelector('.ai-text');
      if (!p) {
        p = document.createElement('div');
        p.className = 'ai-text';
        text.appendChild(p);
      }
      return p;
    }

    try {
      // Fetch raw analytics data from server
      const res = await fetch('/api/analytics/ai');
      const d = await res.json();

      if (d.insight) {
        // Server returned an error message
        if (text) {
          const p = ensureAITextChild();
          if (p) p.innerHTML = formatAIText(d.insight);
          text.style.display = 'block';
        }
        return;
      }

      const analyticsPrompt = `SMOKING BEHAVIOR DATA (analyse ALL of this):
═══ TODAY ═══
Today: ${d.todayCount} cigarettes (goal: ${d.dailyGoal}) | Last cig: ${d.lastMinutesAgo != null ? d.lastMinutesAgo + ' min ago' : 'N/A'}
Rapid repeat (chain): ${d.rapidRepeat ? 'YES' : 'No'}

═══ RISK SCORE ═══
Risk: ${d.riskScore}/100 (${d.riskLevel}) | Breakdown: Limit=${d.scoreBreakdown?.limit || 0}/30, Gap=${d.scoreBreakdown?.gap || 0}/20, Trend=${d.scoreBreakdown?.trend || 0}/20, Peak=${d.scoreBreakdown?.peak || 0}/15, Behavior=${d.scoreBreakdown?.behavior || 0}/15
Flags: ${d.flagsSummary || 'none'}

═══ PATTERNS (14 DAYS) ═══
Daily: ${d.dailySummary}
Avg: ${d.weeklyAvg}/day | Trend direction: ${d.weightedTrend?.direction || d.trend} (${d.weightedTrend?.percentChange || 0}% change, recent avg ${d.weightedTrend?.recentAvg || '?'} vs older ${d.weightedTrend?.olderAvg || '?'})
Peak hour: ${toAMPM(d.peakHour)} | Hourly: ${d.hourlyBreakdown || 'N/A'}
Day-of-week avg: ${d.dowSummary || 'N/A'}
Consecutive limit breach days: ${d.consecutiveBreach || 0}

═══ GAPS ═══
Avg gap: ${d.avgGap || '?'} min
Gap trend: current avg ${d.gapTrend?.currentAvgGap || '?'} min vs previous ${d.gapTrend?.previousAvgGap || '?'} min (${d.gapTrend?.changePercent || 0}% change)

═══ TRIGGERS + MOODS ═══
Triggers: ${d.topTriggers || 'none'} | Moods: ${d.topMoods || 'none'}
Trigger-time combos: ${d.triggerTimeSummary || 'none'}

═══ STREAKS + LIFETIME ═══
Under-limit streak: current ${d.streak?.current || 0} days, best ${d.streak?.best || 0} days
Total lifetime: ${d.totalLifetime} cigarettes | Cost/cig: ₹${d.costPerCig}`;

      const insight = await callPuterAI(
        `Tu ek smoking behavior analyst hai. User ka COMPLETE data diya hai. Tera kaam: data me DEEP patterns dhundh ke user ko batana ki uska behavior kaisa hai.

⚠️ STRICT RULES:
1. SIRF Hinglish (Hindi in English script). Pure English = FAIL.
2. Exactly 5 lines likho. Har line emoji se start. Max 12-15 words per line.
3. Koi "Based on", "Here is", "I recommend" type filler NAHI.
4. SIRF data se dekh ke exact observations likho — koi generic gyaan mat de.

FORMAT (exactly 5 lines):
Line 1: 🔍 Overall behavior summary — improving/worsening/stable + kyu (data se)
Line 2: ⚡ Sabse bada risk factor kya hai abhi — limit/gap/trend/trigger jo bhi highest score contribute kare
Line 3: 📊 Pattern insight — kaunsa din/time/trigger combination sabse dangerous hai
Line 4: 📉 Gap/trend analysis — gaps badh rahe ya chhote ho rahe, trend kahan ja raha
Line 5: 💡 Ek specific actionable insight — data based, generic nahi (e.g. "Mon 2PM habit trigger avoid kar" not "paani pee")

Example output:
🔍 Behavior bigad raha — last 3 din me avg 7→9 cigarettes
⚡ Gap bahut chhota — 25 min avg, chain smoking pattern ban raha
📊 Mon+Tue 11AM-2PM habit trigger se 60% smoking hoti
📉 Gaps 30% se chhote hue last week — control loose ho raha
💡 Tue 1PM pe habit trigger aata — us time 15 min walk try kar

Bas 5 lines. Koi aur text, heading, bullet, explanation NAHI.`,
        analyticsPrompt
      );
      if (text) {
        const p = ensureAITextChild();
        if (p) p.innerHTML = formatAIText(insight);
        text.style.display = 'block';
      }
    } catch (err) {
      if (text) {
        const p = ensureAITextChild();
        if (p) p.innerHTML = formatAIText('Failed to load insight.');
        text.style.display = 'block';
      }
    } finally {
      if (loader) loader.style.display = 'none';
      if (btn) btn.disabled = false;
    }
  };

  // ── Social proof nudge rotation ──
  const socialProofTips = [
    'After 20 min bina peeve — heart rate aur blood pressure normal ho jaata hai.',
    'Ek cigarette skip karo = 11 min extra zindagi. Science says.',
    'Craving sirf 3-5 min rehti hai. Usse zyada khud tabhi rehti hai jab tum sochte raho.',
    '90% ex-smokers ne cold turkey chodha — willpower hi sabse bada tool hai.',
    'Pehle 3 din sabse mushkil. Day 4 se nicotine withdrawal 50% kam ho jaata hai.',
    'Stress se cigarette lena stress nahi hatata — CO2 badha ke anxiety aur badhata hai.',
    'Ek deep breath = 6 sec — itna kaafi hai craving ko weak karne ke liye.',
    '1 saal baad heart disease risk ek smoker ka aadha ho jaata hai.',
    'Paani peena craving ko fast-forward karta hai — try karo.',
    '5 min walk ya 10 pushups — dopamine uthta hai bina cigarette ke.'
  ];

  const spEl = document.getElementById('socialProofText');
  if (spEl) {
    let spIdx = Math.floor(Math.random() * socialProofTips.length);
    spEl.textContent = socialProofTips[spIdx];
    setInterval(() => {
      spIdx = (spIdx + 1) % socialProofTips.length;
      spEl.style.opacity = '0';
      setTimeout(() => {
        spEl.textContent = socialProofTips[spIdx];
        spEl.style.opacity = '1';
      }, 400);
    }, 12000);
  }

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
