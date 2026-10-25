#!/usr/bin/env node
/**
 * gen-activity.mjs — يولّد خريطة مساهمات مصغّرة (آخر 12 أسبوعاً) من GitHub GraphQL.
 * مخرجات: assets/activity-light.svg · assets/activity-dark.svg
 * شفافة، تتكيّف مع الثيم، بلا خلفيات صلبة.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const USER = 'hdsm55';
const WEEKS = 12;

const query = `query{
  user(login:"${USER}"){
    contributionsCollection{
      contributionCalendar{
        totalContributions
        weeks{ contributionDays{ date contributionCount weekday } }
      }
    }
  }
}`;

let data;
try {
  const out = execSync(`gh api graphql -f query='${query}'`, { encoding: 'utf8' });
  data = JSON.parse(out).data.user.contributionsCollection.contributionCalendar;
} catch (e) {
  console.error('GraphQL failed:', e.message);
  process.exit(1);
}

const weeks = data.weeks.slice(-WEEKS);
const total = weeks.reduce((a, w) => a + w.contributionDays.reduce((b, d) => b + d.contributionCount, 0), 0);
const maxDay = Math.max(1, ...weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)));

function level(count) {
  if (count === 0) return 0;
  const r = count / maxDay;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function build(pal) {
  const CELL = 15, GAP = 4, LEFT = 44, TOP = 52;
  const colW = CELL + GAP;
  const W = LEFT + weeks.length * colW + 24;
  const H = TOP + 7 * colW + 34;
  const parts = [];

  // عنوان
  parts.push(`<text x="${LEFT}" y="26" font-family="'Segoe UI',system-ui,sans-serif" font-size="13" font-weight="600" fill="${pal.text}" letter-spacing="1.1">LAST ${WEEKS} WEEKS</text>`);
  parts.push(`<text x="${W - 24}" y="26" text-anchor="end" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="${pal.muted}">${total} contributions</text>`);

  // أسماء الأيام
  ['Mon', 'Wed', 'Fri'].forEach((label, i) => {
    const row = i * 2 + 1;
    parts.push(`<text x="${LEFT - 10}" y="${TOP + row * colW + 11}" text-anchor="end" font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${pal.muted}">${label}</text>`);
  });

  // الخلايا
  weeks.forEach((w, ci) => {
    for (const d of w.contributionDays) {
      const x = LEFT + ci * colW;
      const y = TOP + d.weekday * colW;
      const lv = level(d.contributionCount);
      parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2.5" fill="${pal.levels[lv]}"><title>${esc(d.date)}: ${d.contributionCount}</title></rect>`);
    }
  });

  // مفتاح الألوان
  const ly = TOP + 7 * colW + 14;
  parts.push(`<text x="${LEFT}" y="${ly + 9}" font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${pal.muted}">less</text>`);
  pal.levels.forEach((c, i) => {
    parts.push(`<rect x="${LEFT + 30 + i * colW}" y="${ly}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c}"/>`);
  });
  parts.push(`<text x="${LEFT + 30 + pal.levels.length * colW + 4}" y="${ly + 9}" font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="${pal.muted}">more</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribution activity">
  <title>Contribution activity — last ${WEEKS} weeks</title>
  ${parts.join('\n  ')}
</svg>
`;
}

const light = { text: '#1f2328', muted: '#6e7781', levels: ['#ebedf0', '#ddd6fe', '#c4b5fd', '#a78bfa', '#7c3aed'] };
const dark = { text: '#e6edf3', muted: '#8b949e', levels: ['#21262d', '#3b2f63', '#5b47a8', '#8b6bff', '#a78bfa'] };

mkdirSync('assets', { recursive: true });
writeFileSync('assets/activity-light.svg', build(light));
writeFileSync('assets/activity-dark.svg', build(dark));
console.log('activity ->', JSON.stringify({ weeks: weeks.length, total, maxDay }));
