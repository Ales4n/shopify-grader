export function calculateGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function aggregateScores(categories) {
  const total = Object.values(categories).reduce((sum, cat) => sum + cat.score, 0);
  const max = Object.values(categories).reduce((sum, cat) => sum + cat.max, 0);
  const normalized = Math.round((total / max) * 100);
  return { total: normalized, grade: calculateGrade(normalized) };
}

export function getScoreColor(score, max) {
  const pct = (score / max) * 100;
  if (pct >= 90) return 'excellent';
  if (pct >= 75) return 'good';
  if (pct >= 60) return 'average';
  if (pct >= 40) return 'poor';
  return 'critical';
}
