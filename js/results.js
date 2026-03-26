const CATEGORY_META = {
  seo:         { label: 'SEO', icon: '🔍', color: '#6366f1' },
  performance: { label: 'Performance', icon: '⚡', color: '#f59e0b' },
  shopify:     { label: 'Shopify Config', icon: '🛒', color: '#10b981' },
  content:     { label: 'Content', icon: '✍️', color: '#ec4899' },
};

const GRADE_LABELS = {
  A: 'Excellent', B: 'Good', C: 'Needs Work', D: 'Significant Issues', F: 'Critical Problems'
};

const LOADING_STEPS = ['step-fetch', 'step-seo', 'step-perf', 'step-shopify', 'step-content'];
let stepIndex = 0;
let loadingInterval = null;

function startLoadingAnimation() {
  const bar = document.getElementById('loadingBar');
  let progress = 0;

  function nextStep() {
    if (stepIndex < LOADING_STEPS.length) {
      const el = document.getElementById(LOADING_STEPS[stepIndex]);
      if (el) {
        el.querySelector('.step-icon').textContent = '✓';
        el.querySelector('.step-icon').className = 'step-icon done';
      }
      stepIndex++;
    }
  }

  loadingInterval = setInterval(() => {
    progress = Math.min(progress + (Math.random() * 3 + 1), 92);
    bar.style.width = progress + '%';
    if (progress > 15 && stepIndex < 1) nextStep();
    if (progress > 35 && stepIndex < 2) nextStep();
    if (progress > 55 && stepIndex < 3) nextStep();
    if (progress > 75 && stepIndex < 4) nextStep();
    if (progress > 88 && stepIndex < 5) nextStep();
  }, 300);
}

function stopLoadingAnimation() {
  clearInterval(loadingInterval);
  const bar = document.getElementById('loadingBar');
  bar.style.width = '100%';
  while (stepIndex < LOADING_STEPS.length) {
    const el = document.getElementById(LOADING_STEPS[stepIndex]);
    if (el) {
      el.querySelector('.step-icon').textContent = '✓';
      el.querySelector('.step-icon').className = 'step-icon done';
    }
    stepIndex++;
  }
}

function showError(msg) {
  document.getElementById('loadingScreen').hidden = true;
  document.getElementById('resultsScreen').hidden = true;
  const errScreen = document.getElementById('errorScreen');
  errScreen.hidden = false;
  document.getElementById('errorMessage').textContent = msg;
}

function scoreColor(score) {
  if (score >= 90) return '#22c55e';
  if (score >= 75) return '#84cc16';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function renderGauge(score) {
  const circumference = 502;
  const offset = circumference - (score / 100) * circumference;
  const fill = document.getElementById('gaugeFill');
  fill.style.strokeDashoffset = offset;
  fill.style.stroke = scoreColor(score);
}

function renderScoreHeader(data) {
  const { total, grade } = data.score;
  document.getElementById('scoreNumber').textContent = total;
  document.getElementById('scoreGrade').textContent = grade;
  document.getElementById('scoreGrade').style.color = scoreColor(total);
  document.getElementById('scoreLabel').textContent = GRADE_LABELS[grade] || 'Analyzed';
  document.getElementById('scoreSublabel').textContent = `Overall score for ${data.url}`;
  document.getElementById('reportUrl').textContent = data.url;
  document.getElementById('reportDate').textContent = `Analyzed on ${new Date(data.analyzedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;

  setTimeout(() => renderGauge(total), 100);
}

function renderCategoryCards(categories) {
  const container = document.getElementById('categoryCards');
  container.innerHTML = Object.entries(categories).map(([key, cat]) => {
    const meta = CATEGORY_META[key];
    const pct = Math.round((cat.score / cat.max) * 100);
    const color = scoreColor(pct);
    return `
      <div class="cat-card" data-category="${key}">
        <div class="cat-card-header">
          <span class="cat-card-icon">${meta.icon}</span>
          <span class="cat-card-name">${meta.label}</span>
          <span class="cat-card-score" style="color:${color}">${cat.score}<span class="cat-card-max">/${cat.max}</span></span>
        </div>
        <div class="cat-bar-wrap">
          <div class="cat-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        <button class="cat-expand-btn" onclick="toggleCategory('${key}')">
          View checks <span class="expand-arrow" id="arrow-${key}">▼</span>
        </button>
      </div>
    `;
  }).join('');
}

function statusIcon(status) {
  if (status === 'pass') return '<span class="check-icon pass">✅</span>';
  if (status === 'warn') return '<span class="check-icon warn">⚠️</span>';
  return '<span class="check-icon fail">❌</span>';
}

function renderChecks(categories) {
  const section = document.getElementById('checksSection');
  section.innerHTML = Object.entries(categories).map(([key, cat]) => {
    const meta = CATEGORY_META[key];
    return `
      <div class="checks-group" id="checks-${key}" hidden>
        <h3 class="checks-group-title">${meta.icon} ${meta.label} — Detailed Checks</h3>
        <div class="checks-list">
          ${cat.checks.map(check => `
            <div class="check-item check-${check.status}">
              <div class="check-row">
                ${statusIcon(check.status)}
                <div class="check-info">
                  <div class="check-name">${check.name}
                    <span class="check-pts">${check.score}/${check.maxScore} pts</span>
                  </div>
                  <div class="check-details">${check.details || ''}</div>
                  ${check.recommendation ? `<div class="check-rec">💡 ${check.recommendation}</div>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function toggleCategory(key) {
  const group = document.getElementById(`checks-${key}`);
  const arrow = document.getElementById(`arrow-${key}`);
  const isHidden = group.hidden;
  group.hidden = !isHidden;
  arrow.textContent = isHidden ? '▲' : '▼';
  if (isHidden) group.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.toggleCategory = toggleCategory;

let analysisStarted = false;

async function runAnalysis() {
  if (analysisStarted) return;
  analysisStarted = true;

  const url = sessionStorage.getItem('grader_url');
  if (!url) {
    window.location.href = '/';
    return;
  }

  startLoadingAnimation();

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    stopLoadingAnimation();

    if (!res.ok || data.error) {
      showError(data.error || 'An unexpected error occurred. Please try again.');
      return;
    }

    document.getElementById('loadingScreen').hidden = true;
    document.getElementById('errorScreen').hidden = true;
    document.getElementById('resultsScreen').hidden = false;

    renderScoreHeader(data);
    renderCategoryCards(data.score.categories);
    renderChecks(data.score.categories);

    // Auto-expand first category
    setTimeout(() => toggleCategory('seo'), 400);

  } catch (err) {
    stopLoadingAnimation();
    showError('An unexpected error occurred. Please check your connection and try again.');
  }
}

runAnalysis();
