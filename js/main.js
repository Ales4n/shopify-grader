const form = document.getElementById('analyzeForm');
const input = document.getElementById('storeUrl');
const btn = document.getElementById('analyzeBtn');
const errorEl = document.getElementById('inputError');

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
  input.classList.add('input-error-state');
}

function clearError() {
  errorEl.hidden = true;
  input.classList.remove('input-error-state');
}

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  url = url.replace(/\/+$/, '');
  return url;
}

function isValidDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes('.');
  } catch (_) {
    return false;
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearError();

  const raw = input.value.trim();
  if (!raw) {
    showError('Please enter a store URL.');
    input.focus();
    return;
  }

  const url = normalizeUrl(raw);
  if (!isValidDomain(url)) {
    showError('Please enter a valid URL (e.g., mystore.com)');
    input.focus();
    return;
  }

  sessionStorage.setItem('grader_url', url);
  window.location.href = '/results.html';
});

input.addEventListener('input', clearError);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') form.dispatchEvent(new Event('submit'));
});
