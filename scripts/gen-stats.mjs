#!/usr/bin/env node
/**
 * gen-stats.mjs — يولّد شريط إحصاءات شفافاً (فاتح/داكن) من GitHub API الحقيقي.
 * لا خلفيات ولا مربعات: أرقام كبيرة + فواصل رقيقة فقط.
 * التشغيل: node scripts/gen-stats.mjs
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const USER = 'hdsm55';

function gh(path) {
  return JSON.parse(execSync(`gh api "${path}"`, { encoding: 'utf8' }));
}
function ghSearch(q) {
  return gh(`search/issues?q=${encodeURIComponent(q)}&per_page=1`).total_count;
}

// --- بيانات حقيقية ---
const user = gh(`users/${USER}`);
const repos = gh(`users/${USER}/repos?per_page=100`);
const stars = repos.reduce((a, r) => a + (r.stargazers_count || 0), 0);
const mergedPRs = ghSearch(`author:${USER} type:pr is:merged`);
const totalPRs = ghSearch(`author:${USER} type:pr`);
const issues = ghSearch(`author:${USER} type:issue`);

// مساهمات آخر سنة (GraphQL) — تُتخطّى بهدوء إن لم تتوفر الصلاحية
let contributions = null;
try {
  const q = `query{user(login:"${USER}"){contributionsCollection{contributionCalendar{totalContributions}}}}`;
  const out = execSync(`gh api graphql -f query='${q}'`, { encoding: 'utf8' });
  contributions = JSON.parse(out).data.user.contributionsCollection.contributionCalendar.totalContributions;
} catch { /* اختياري */ }

const stats = [
  { n: contributions ?? mergedPRs, label: 'contributions · year' },
  { n: mergedPRs, label: 'merged pull requests' },
  { n: totalPRs, label: 'pull requests opened' },
  { n: user.followers, label: 'followers' },
  { n: stars, label: 'stars earned' },
  { n: user.public_repos, label: 'public repos' },
].filter((s) => s.n !== null);

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function build(palette) {
  const { text, accent, muted, rule } = palette;
  const W = 1180;
  const H = 150;
  const cols = stats.length;
  const colW = W / cols;
  let parts = [];
  stats.forEach((s, i) => {
    const cx = colW * i + colW / 2;
    parts.push(`<text x="${cx}" y="66" text-anchor="middle" font-family="'Segoe UI',system-ui,-apple-system,sans-serif" font-size="46" font-weight="700" fill="${accent}">${esc(String(s.n))}</text>`);
    parts.push(`<text x="${cx}" y="96" text-anchor="middle" font-family="'Segoe UI',system-ui,-apple-system,sans-serif" font-size="13" fill="${muted}" letter-spacing="0.6">${esc(s.label)}</text>`);
  });
  for (let i = 1; i < cols; i++) {
    const x = colW * i;
    parts.push(`<line x1="${x}" y1="34" x2="${x}" y2="106" stroke="${rule}" stroke-width="1"/>`);
  }
  parts.push(`<line x1="40" y1="132" x2="${W - 40}" y2="132" stroke="${rule}" stroke-width="1"/>`);
  parts.push(`<text x="${W / 2}" y="146" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="11" fill="${muted}" letter-spacing="1.6">LIVE FROM GITHUB API · UPDATED AUTOMATICALLY</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub statistics">
  <title>GitHub statistics for ${USER}</title>
  ${parts.join('\n  ')}
</svg>
`;
}

const light = { text: '#1f2328', accent: '#6d4aff', muted: '#57606a', rule: '#d0d7de' };
const dark = { text: '#e6edf3', accent: '#a78bfa', muted: '#8b949e', rule: '#30363d' };

mkdirSync('assets', { recursive: true });
writeFileSync('assets/stats-light.svg', build(light));
writeFileSync('assets/stats-dark.svg', build(dark));
console.log('stats ->', JSON.stringify({ contributions, mergedPRs, totalPRs, followers: user.followers, stars, repos: user.public_repos }));
