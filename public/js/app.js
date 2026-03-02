document.addEventListener('DOMContentLoaded', function () {
  const oliveLight = '#a3c9a8';
  const olive = '#6b8f71';
  const oliveDark = '#3d5a40';
  const gridColor = 'rgba(107, 143, 113, 0.12)';
  const tickColor = '#8aa88a';

  const AI_MODEL = 'gpt-4.1-mini';

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

  let trendChart = null, hourlyChart = null, healthCorrChart = null, triggerChartObj = null, moodChartObj = null;

  // ══════════════════════════════════════
  // ── PUTER.JS AI HELPER (FREE GPT) ──
  // ══════════════════════════════════════
  async function callPuterAI(systemPrompt, userPrompt) {
    try {
      const resp = await puter.ai.chat(userPrompt, {
        model: AI_MODEL,
        system: systemPrompt
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

  function buildHealthCorrChart(data) {
    const ctx = document.getElementById('healthCorrChart');
    if (!ctx) return;
    if (healthCorrChart) healthCorrChart.destroy();
    const labels = data.map(d => d.date);
    healthCorrChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Cigarettes', data: data.map(d => d.count),
            borderColor: olive, backgroundColor: 'rgba(107,143,113,0.1)',
            borderWidth: 2.5, fill: false, tension: 0.3, yAxisID: 'y',
            pointRadius: 4, pointBackgroundColor: oliveLight
          },
          {
            label: 'HRV', data: data.map(d => d.hrv),
            borderColor: '#8ab4f8', backgroundColor: 'transparent',
            borderWidth: 2, borderDash: [5, 3], fill: false, tension: 0.3, yAxisID: 'y1',
            pointRadius: d => d.raw !== null ? 3 : 0, spanGaps: true
          },
          {
            label: 'Sleep', data: data.map(d => d.sleepScore),
            borderColor: '#ffd93d', backgroundColor: 'transparent',
            borderWidth: 2, borderDash: [3, 3], fill: false, tension: 0.3, yAxisID: 'y1',
            pointRadius: d => d.raw !== null ? 3 : 0, spanGaps: true
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: tickColor, font: { size: 9 } }, grid: { color: gridColor } },
          y: { position: 'left', ticks: { color: olive, font: { size: 10 } }, grid: { color: gridColor }, beginAtZero: true, title: { display: true, text: 'Cigs', color: olive, font: { size: 10 } } },
          y1: { position: 'right', ticks: { color: '#8ab4f8', font: { size: 10 } }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Health', color: '#8ab4f8', font: { size: 10 } } }
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
  if (window.__hourly) buildHourlyChart(window.__hourly);
  if (window.__healthCorr) buildHealthCorrChart(window.__healthCorr);

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

  // Expose modal functions globally
  window.openSmokeModal = function () {
    selectedTrigger = '';
    selectedMood = '';
    document.querySelectorAll('.trigger-chip, .mood-chip').forEach(b => b.classList.remove('chip-active'));
    const noteInput = document.getElementById('smokeNote');
    if (noteInput) noteInput.value = '';
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

    try {
      const res = await fetch('/api/smoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: selectedTrigger, mood: selectedMood, note })
      });
      const data = await res.json();

      if (data.success) {
        // Update dashboard elements
        const countEl = document.getElementById('todayCountDisplay');
        if (countEl) countEl.textContent = data.todayCount;

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
          const smokePrompt = `User just smoked cigarette #${data.todayCount} today (goal: ${data.dailyGoal}/day).
Trigger: ${data.trigger || 'not specified'}. Mood: ${data.mood || 'not specified'}.
Weekly average: ${data.weeklyAvg} cigs/day. Trend: ${data.trend}. Peak hour: ${data.peakHour}:00.
Average gap between cigarettes: ${data.lastGapMinutes || 'unknown'} min.
Risk level: ${data.risk.riskLevel} (${data.risk.score}/100).
${data.health ? `Health: HRV ${data.health.hrv}, Sleep ${data.health.sleepScore}/100, SpO2 ${data.health.spo2}%` : 'No health data today.'}
${data.rapidRepeat ? 'WARNING: This is a rapid repeat (2 cigarettes within 60 min)!' : ''}`;

          callPuterAI(
            'You are a supportive smoking cessation coach. Give brief, personalized feedback (2-3 sentences) based on the data. Be empathetic but direct. If there are concerning patterns, mention them. Include one specific actionable tip. Use Hindi-English mix if the trigger/mood suggests an Indian user. Keep it warm and motivating.',
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

    const dashPrompt = `Smoking tracker data for a user trying to quit:
- Today's count: ${d.todayCount} (daily goal: ${d.dailyGoal})
- Weekly average: ${d.weeklyAvg} cigs/day
- 7-day trend: ${d.trend}
- Peak smoking hour: ${d.peakHour}:00
- Average gap between cigarettes: ${d.avgGap || 'unknown'} min
- Risk score: ${d.riskScore}/100 (${d.riskLevel})
- Current streak of days under goal: ${d.streak.currentStreak}
- Today vs yesterday: ${d.streak.todayCount} vs ${d.streak.yesterdayCount}
${d.flags && d.flags.length > 0 ? '- Risk flags: ' + d.flags.join(', ') : ''}
${d.health ? `- Health: HRV ${d.health.hrv}, RHR ${d.health.restingHR}, Sleep ${d.health.sleepScore}/100, SpO2 ${d.health.spo2}%` : '- No health data today'}`;

    callPuterAI(
      'You are a compassionate smoking cessation AI coach. Analyze the user\'s data and give personalized advice in 3-4 sentences. Highlight what\'s going well (if anything), warn about risks, and give ONE specific actionable tip for the next few hours. Keep it warm, direct, and motivating. Mix Hindi-English naturally.',
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

      const analyticsPrompt = `Smoking tracker analytics:
- Weekly average: ${d.weeklyAvg} cigs/day. Trend: ${d.trend}. Peak hour: ${d.peakHour}:00.
- Lifetime total: ${d.totalLifetime} cigarettes.
- Top triggers: ${d.topTriggers || 'none tracked'}. Top moods: ${d.topMoods || 'none tracked'}.
- Last 7 days: ${JSON.stringify(d.dailySummary)}
${d.healthSummary ? '- Health: ' + d.healthSummary : ''}`;

      const insight = await callPuterAI(
        'You are a data analyst for a smoking cessation app. Analyze the user\'s patterns and give a concise 3-4 sentence insight. Identify the most important pattern, the biggest risk factor, and one data-driven recommendation. Be specific with numbers. Mix Hindi-English naturally.',
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

  // ══════════════════════════════════════
  // ── HEALTH AI INSIGHT (Puter.js) ──
  // ══════════════════════════════════════
  window.loadHealthAI = async function () {
    const loader = document.getElementById('healthAILoader');
    const result = document.getElementById('healthAIResult');
    const text = document.getElementById('healthAIText');
    const btn = document.getElementById('refreshHealthAI');
    if (loader) loader.style.display = 'block';
    if (result) result.style.display = 'none';
    if (btn) btn.disabled = true;
    try {
      // Fetch raw health + smoking data from server
      const res = await fetch('/api/health/ai');
      const d = await res.json();

      if (d.noData) {
        if (text) text.innerHTML = formatAIText(d.insight);
        if (result) result.style.display = 'block';
        return;
      }

      const healthPrompt = `Health + smoking data for analysis:
- HRV: ${d.hrv} (baseline: ${d.baselineHRV}). Resting HR: ${d.restingHR}. Sleep score: ${d.sleepScore}/100. SpO2: ${d.spo2}%.
- Today's cigarettes: ${d.todayCount}. Yesterday: ${d.yesterdayCount}. Weekly avg: ${d.weeklyAvg}.
- Trend: ${d.trend}.`;

      const insight = await callPuterAI(
        'You are a health analyst specializing in smoking\'s impact on biometrics. Analyze the correlation between the user\'s smoking and health metrics. Give 3-4 sentences: how smoking is affecting their HRV/sleep/SpO2, compare to baseline, and give one specific health-focused tip. Be medically informed but accessible. Mix Hindi-English naturally.',
        healthPrompt
      );
      if (text) text.innerHTML = formatAIText(insight);
      if (result) result.style.display = 'block';
    } catch (err) {
      if (text) text.innerHTML = formatAIText('Failed to load insight.');
      if (result) result.style.display = 'block';
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
