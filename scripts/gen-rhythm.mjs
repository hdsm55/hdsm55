#!/usr/bin/env node
/**
 * gen-rhythm.mjs — إيقاع الأسبوع: أي أيام الأسبوع أكثر إنتاجاً (بيانات حقيقية).
 * ينتج: assets/rhythm-{light,dark}.svg
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const USER = 'hdsm55';
const q = `query{user(login:"${USER}"){contributionsCollection{contributionCalendar{weeks{contributionDays{weekday contributionCount}}}}}}`;
const out = execSync(`gh api graphql -F query=@- <<'GQL'\n${q}\nGQL`, { encoding: 'utf8', shell: '/bin/bash' });
const days = JSON.parse(out).data.user.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays);

const totals = Array(7).fill(0);
const counts = Array(7).fill(0);
for (const d of days) { totals[d.weekday] += d.contributionCount; counts[d.weekday]++; }
const avg = totals.map((t, i) => (counts[i] ? t / counts[i] : 0));
const max = Math.max(...avg, 1);

const LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function build(pal) {
  const W = 560, H = 176, TOP = 52, BASE = H - 40;
  const slot = (W - 40) / 7;
  const bars = avg.map((v, i) => {
    const h = Math.max(3, (v / max) * (BASE - TOP));
    const x = 20 + i * slot + slot * 0.2;
    const w = slot * 0.6;
    const isPeak = v === max;
    return `<rect x="${x.toFixed(1)}" y="${(BASE - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${isPeak ? pal.peak : pal.bar}" opacity="${isPeak ? 1 : 0.78}"><title>${LABELS[i]}: ${v.toFixed(1)} avg/day</title></rect>
  <text x="${(x + w / 2).toFixed(1)}" y="${BASE + 17}" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="11" fill="${pal.muted}">${LABELS[i]}</text>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly rhythm">
  <text x="20" y="27" font-family="'Segoe UI',system-ui,sans-serif" font-size="13" font-weight="600" fill="${pal.text}" letter-spacing="1">WEEKLY RHYTHM</text>
  <text x="${W - 20}" y="27" text-anchor="end" font-family="'Segoe UI',system-ui,sans-serif" font-size="11" fill="${pal.muted}">avg contributions per weekday</text>
  <line x1="20" y1="${BASE}" x2="${W - 20}" y2="${BASE}" stroke="${pal.axis}" stroke-width="1"/>
  ${bars}
</svg>
`;
}

const light = { text: '#1f2328', muted: '#6e7781', bar: '#a78bfa', peak: '#6d4aff', axis: '#d0d7de' };
const dark = { text: '#e6edf3', muted: '#8b949e', bar: '#8b6bff', peak: '#a78bfa', axis: '#30363d' };

mkdirSync('assets', { recursive: true });
writeFileSync('assets/rhythm-light.svg', build(light));
writeFileSync('assets/rhythm-dark.svg', build(dark));
console.log('rhythm ->', JSON.stringify(Object.fromEntries(LABELS.map((l, i) => [l, +avg[i].toFixed(1)]))));
