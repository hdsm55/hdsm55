#!/usr/bin/env node
/**
 * gen-insights.mjs — لوحات إحصائية حقيقية من GitHub GraphQL (تشمل المستودعات الخاصة).
 * ينتج: assets/mix-{light,dark}.svg  (توزيع أنواع العمل)
 *        assets/langs-{light,dark}.svg (توزيع اللغات بحسب المساهمات)
 *        assets/months-{light,dark}.svg (أعمدة شهرية لآخر 12 شهراً)
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const USER = 'hdsm55';

const query = `query{
  user(login:"${USER}"){
    contributionsCollection{
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      commitContributionsByRepository(maxRepositories:30){
        repository{ primaryLanguage{ name color } isPrivate }
        contributions(first:1){ totalCount }
      }
      contributionCalendar{ weeks{ contributionDays{ date contributionCount } } }
    }
  }
}`;

const out = execSync(`gh api graphql -F query=@- <<'GQL'
${query}
GQL`, { encoding: 'utf8', shell: '/bin/bash' });
const c = JSON.parse(out).data.user.contributionsCollection;

/* ---------- 1) توزيع أنواع العمل ---------- */
const work = [
  { label: 'Commits', value: c.totalCommitContributions },
  { label: 'Pull requests', value: c.totalPullRequestContributions },
  { label: 'Reviews', value: c.totalPullRequestReviewContributions },
  { label: 'Issues', value: c.totalIssueContributions },
].filter((w) => w.value > 0);

/* ---------- 2) توزيع اللغات ---------- */
const langMap = new Map();
for (const r of c.commitContributionsByRepository) {
  const name = r.repository.primaryLanguage?.name;
  if (!name) continue;
  langMap.set(name, (langMap.get(name) || 0) + r.contributions.totalCount);
}
const langs = [...langMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
const langTotal = langs.reduce((a, [, v]) => a + v, 0) || 1;

/* ---------- 3) الأعمدة الشهرية (آخر 12) ---------- */
const days = c.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
const byMonth = new Map();
for (const d of days) {
  const m = d.date.slice(0, 7);
  byMonth.set(m, (byMonth.get(m) || 0) + d.contributionCount);
}
const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);
const PALETTE = ['#6d4aff', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

/* ---------- بناء: شريط توزيع ---------- */
function buildMix(pal) {
  const W = 560, H = 132, BARW = W - 40, BARH = 16, Y = 54;
  const total = work.reduce((a, w) => a + w.value, 0) || 1;
  let x = 20;
  const seg = work.map((w, i) => {
    const wd = (w.value / total) * BARW;
    const r = `<rect x="${x.toFixed(1)}" y="${Y}" width="${Math.max(wd - 2, 1).toFixed(1)}" height="${BARH}" rx="4" fill="${PALETTE[i % PALETTE.length]}"><title>${esc(w.label)}: ${w.value}</title></rect>`;
    x += wd;
    return r;
  }).join('\n  ');
  const legend = work.map((w, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const lx = 20 + col * 180, ly = Y + BARH + 28 + row * 22;
    return `<circle cx="${lx + 4}" cy="${ly - 4}" r="4" fill="${PALETTE[i % PALETTE.length]}"/><text x="${lx + 16}" y="${ly}" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="${pal.text}">${esc(w.label)} <tspan fill="${pal.muted}">${w.value}</tspan></text>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribution breakdown">
  <text x="20" y="28" font-family="'Segoe UI',system-ui,sans-serif" font-size="13" font-weight="600" fill="${pal.text}" letter-spacing="1">HOW I CONTRIBUTE</text>
  <text x="${W - 20}" y="28" text-anchor="end" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="${pal.muted}">${fmt(total)} total</text>
  ${seg}
  ${legend}
</svg>
`;
}

/* ---------- بناء: توزيع اللغات ---------- */
function buildLangs(pal) {
  const W = 560, ROWH = 26, TOP = 52, H = TOP + langs.length * ROWH + 16;
  const rows = langs.map(([name, v], i) => {
    const pct = (v / langTotal) * 100;
    const y = TOP + i * ROWH;
    const barW = (pct / 100) * 300;
    return `<text x="20" y="${y + 11}" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="${pal.text}">${esc(name)}</text>
  <rect x="150" y="${y}" width="300" height="12" rx="6" fill="${pal.track}"/>
  <rect x="150" y="${y}" width="${Math.max(barW, 3).toFixed(1)}" height="12" rx="6" fill="${PALETTE[i % PALETTE.length]}"/>
  <text x="${W - 20}" y="${y + 11}" text-anchor="end" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="${pal.muted}">${pct.toFixed(1)}%</text>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Language mix">
  <text x="20" y="28" font-family="'Segoe UI',system-ui,sans-serif" font-size="13" font-weight="600" fill="${pal.text}" letter-spacing="1">LANGUAGE MIX</text>
  ${rows}
</svg>
`;
}

/* ---------- بناء: أعمدة شهرية ---------- */
function buildMonths(pal) {
  const W = 560, H = 170, TOP = 46, BASE = H - 42;
  const max = Math.max(1, ...months.map(([, v]) => v));
  const n = months.length || 1;
  const slot = (W - 40) / n;
  const bars = months.map(([m, v], i) => {
    const h = Math.max(3, ((v / max) * (BASE - TOP)));
    const x = 20 + i * slot + slot * 0.18;
    const w = slot * 0.64;
    const label = m.slice(5);
    return `<rect x="${x.toFixed(1)}" y="${(BASE - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${pal.bar}"><title>${esc(m)}: ${v}</title></rect>
  <text x="${(x + w / 2).toFixed(1)}" y="${BASE + 16}" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${pal.muted}">${esc(label)}</text>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly contributions">
  <text x="20" y="26" font-family="'Segoe UI',system-ui,sans-serif" font-size="13" font-weight="600" fill="${pal.text}" letter-spacing="1">MONTHLY OUTPUT</text>
  <line x1="20" y1="${BASE}" x2="${W - 20}" y2="${BASE}" stroke="${pal.axis}" stroke-width="1"/>
  ${bars}
</svg>
`;
}

const light = { text: '#1f2328', muted: '#6e7781', track: '#eaeef2', bar: '#a78bfa', axis: '#d0d7de' };
const dark = { text: '#e6edf3', muted: '#8b949e', track: '#21262d', bar: '#8b6bff', axis: '#30363d' };

mkdirSync('assets', { recursive: true });
writeFileSync('assets/mix-light.svg', buildMix(light));
writeFileSync('assets/mix-dark.svg', buildMix(dark));
writeFileSync('assets/langs-light.svg', buildLangs(light));
writeFileSync('assets/langs-dark.svg', buildLangs(dark));
writeFileSync('assets/months-light.svg', buildMonths(light));
writeFileSync('assets/months-dark.svg', buildMonths(dark));

console.log('insights ->', JSON.stringify({ work, langs, months: months.map(([m]) => m) }));
