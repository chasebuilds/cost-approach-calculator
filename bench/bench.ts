import { estimate, type EstimateInput } from "../src/calc";
import { SAMPLE_TABLE } from "../src/costTable";
import { defaults } from "../src/state";

const s = defaults();
const input = (gla: number, eff: number): EstimateInput => ({
  land: s.landValue,
  building: {
    buildingType: s.buildingType, quality: s.quality, glaSqFt: gla, garageSqFt: s.garage, porchSqFt: s.porch,
    basementSqFt: s.basement, basementFinished: s.basementFinished, centralHvac: s.hvac,
    regionalMultiplier: s.regional, costIndex: s.index,
  },
  effectiveAge: eff, totalEconomicLife: s.tel, curablePhysicalCost: s.curablePhys, functionalItems: s.func,
  external: { mode: "percent", pct: s.extPct / 100 }, incentivePct: s.incentive / 100,
});

// Deterministic sweep: GLA 800..3,999 sq ft x effective age 0..80 years.
const cases: EstimateInput[] = [];
for (let gla = 800; gla < 4000; gla += 10) for (let eff = 0; eff <= 80; eff++) cases.push(input(gla, eff));

// Invariants that must hold for every case.
let bad = 0;
for (const c of cases) {
  const e = estimate(c, SAMPLE_TABLE);
  const ok =
    Math.abs(e.indicatedValue - (e.land + e.rcn.rcn - e.totalDepreciation + e.incentive)) < 1e-6 &&
    e.depreciatedImprovements >= -1e-6 &&
    e.totalDepreciation <= e.rcn.rcn + 1e-6;
  if (!ok) bad++;
}

const t0 = performance.now();
let sink = 0;
for (let r = 0; r < 5; r++) for (const c of cases) sink += estimate(c, SAMPLE_TABLE).indicatedValue;
const ms = performance.now() - t0;
const n = cases.length * 5;

console.log(`cases swept: ${cases.length}`);
console.log(`invariant violations: ${bad}`);
console.log(`estimates timed: ${n}`);
console.log(`total ms: ${ms.toFixed(1)}`);
console.log(`estimates per second: ${Math.round(n / (ms / 1000))}`);
console.log(`(checksum ${Math.round(sink)})`);
