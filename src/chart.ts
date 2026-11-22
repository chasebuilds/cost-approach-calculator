import type { DepPoint } from "./calc";

const fmt = (n: number): string =>
  n >= 1000 ? `$${Math.round(n / 1000).toLocaleString("en-US")}k` : `$${Math.round(n)}`;

/** Inline SVG chart: physical depreciation ($) and depreciated value over age, with effective-age marker. */
export function depreciationChart(points: DepPoint[], effectiveAge: number): string {
  const W = 560;
  const H = 260;
  const m = { l: 56, r: 14, t: 14, b: 36 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const maxAge = points[points.length - 1]?.age ?? 1;
  const maxY = Math.max(1, ...points.map((p) => p.depreciatedValue + p.depreciation));
  const x = (age: number) => m.l + (age / maxAge) * pw;
  const y = (v: number) => m.t + ph - (v / maxY) * ph;
  const line = (f: (p: DepPoint) => number) =>
    points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(f(p)).toFixed(1)}`).join(" ");

  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const v = (maxY / 4) * i;
    grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/>` +
      `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" class="tick">${fmt(v)}</text>`;
  }
  const step = Math.max(1, Math.round(maxAge / 6));
  for (let a = 0; a <= maxAge; a += step) {
    grid += `<text x="${x(a)}" y="${H - m.b + 16}" text-anchor="middle" class="tick">${a}</text>`;
  }
  const ea = Math.min(Math.max(effectiveAge, 0), maxAge);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Physical depreciation and depreciated value by age" class="chart">
    ${grid}
    <path d="${line((p) => p.depreciatedValue)}" class="l-value"/>
    <path d="${line((p) => p.depreciation)}" class="l-dep"/>
    <line x1="${x(ea)}" x2="${x(ea)}" y1="${m.t}" y2="${m.t + ph}" class="marker"/>
    <text x="${x(ea) + 4}" y="${m.t + 12}" class="tick">effective age ${Math.round(effectiveAge)}</text>
    <text x="${m.l + pw / 2}" y="${H - 4}" text-anchor="middle" class="tick">Age (years)</text>
  </svg>
  <p class="legend"><span class="sw sw-value"></span>Depreciated cost of improvements <span class="sw sw-dep"></span>Physical depreciation</p>`;
}
