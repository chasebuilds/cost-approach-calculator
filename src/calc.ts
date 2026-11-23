import type { CostTable } from "./costTable";

export const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/* ---------- Land ---------- */

export interface LandComp {
  price: number;
  areaSqFt: number;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const hi = s[mid] ?? 0;
  return s.length % 2 ? hi : ((s[mid - 1] ?? 0) + hi) / 2;
}

/** Land value = median comp $/sq ft x subject land area. */
export function landFromComps(comps: LandComp[], subjectAreaSqFt: number) {
  const perSqFt = median(
    comps.filter((c) => c.areaSqFt > 0 && c.price > 0).map((c) => c.price / c.areaSqFt),
  );
  return { perSqFt, value: perSqFt * Math.max(0, subjectAreaSqFt) };
}

/* ---------- Replacement cost new ---------- */

export interface BuildingInput {
  buildingType: string;
  quality: string;
  glaSqFt: number;
  garageSqFt: number;
  porchSqFt: number;
  basementSqFt: number;
  basementFinished: boolean;
  centralHvac: boolean;
  regionalMultiplier: number;
  costIndex: number;
}

export interface RcnResult {
  baseUnitCost: number;
  qualityMultiplier: number;
  baseBuilding: number;
  features: { name: string; amount: number }[];
  featuresTotal: number;
  directCost: number;
  afterRegional: number;
  afterIndex: number;
  indirectCosts: number;
  rcn: number;
}

export function replacementCostNew(b: BuildingInput, t: CostTable): RcnResult {
  const gla = Math.max(0, b.glaSqFt);
  const baseUnitCost = t.baseBuilding[b.buildingType] ?? 0;
  const qualityMultiplier = t.quality[b.quality] ?? 1;
  const baseBuilding = gla * baseUnitCost * qualityMultiplier;
  const bsmtRate = b.basementFinished ? t.basementFinishedPerSqFt : t.basementUnfinishedPerSqFt;
  const features = [
    { name: "Garage", amount: Math.max(0, b.garageSqFt) * t.garagePerSqFt },
    { name: "Porch", amount: Math.max(0, b.porchSqFt) * t.porchPerSqFt },
    {
      name: b.basementFinished ? "Basement (finished)" : "Basement (unfinished)",
      amount: Math.max(0, b.basementSqFt) * bsmtRate,
    },
    { name: "Central HVAC", amount: b.centralHvac ? gla * t.hvacCentralPerSqFtGla : 0 },
  ];
  const featuresTotal = features.reduce((s, f) => s + f.amount, 0);
  const directCost = baseBuilding + featuresTotal;
  const afterRegional = directCost * b.regionalMultiplier;
  const afterIndex = afterRegional * b.costIndex;
  const indirectCosts = afterIndex * t.indirectPct;
  return {
    baseUnitCost,
    qualityMultiplier,
    baseBuilding,
    features,
    featuresTotal,
    directCost,
    afterRegional,
    afterIndex,
    indirectCosts,
    rcn: afterIndex + indirectCosts,
  };
}

/* ---------- Physical depreciation (age-life) ---------- */

/** Age-life rate = effective age / total economic life, held between 0 and 1. */
export function ageLifeRate(effectiveAge: number, totalEconomicLife: number): number {
  if (totalEconomicLife <= 0) return 1;
  return clamp(effectiveAge / totalEconomicLife, 0, 1);
}

/** Starting suggestion for effective age: actual age x condition ratio, capped at TEL. */
export function suggestEffectiveAge(actualAge: number, ratio: number, tel: number): number {
  return clamp(actualAge * ratio, 0, Math.max(0, tel));
}

export interface PhysicalResult {
  rate: number;
  curable: number;
  incurable: number;
  total: number;
}

/**
 * Curable physical = cost to cure deferred maintenance (capped at RCN).
 * Incurable physical = age-life rate x (RCN - curable).
 */
export function physicalDepreciation(
  rcn: number,
  effectiveAge: number,
  totalEconomicLife: number,
  curableCost: number,
): PhysicalResult {
  const rate = ageLifeRate(effectiveAge, totalEconomicLife);
  const curable = clamp(curableCost, 0, rcn);
  const incurable = (rcn - curable) * rate;
  return { rate, curable, incurable, total: curable + incurable };
}

/* ---------- Functional obsolescence ---------- */

export type FunctionalItem =
  | { kind: "curable"; name: string; costToCure: number }
  | { kind: "incurable"; name: string; annualLoss: number; capRate: number };

/** Curable: the cost to cure. Incurable: annual rent loss capitalized at the cap rate. */
export function functionalItemAmount(i: FunctionalItem): number {
  if (i.kind === "curable") return Math.max(0, i.costToCure);
  return i.capRate > 0 ? Math.max(0, i.annualLoss) / i.capRate : 0;
}

export function functionalObsolescence(items: FunctionalItem[], available: number) {
  const sum = (kind: FunctionalItem["kind"]) =>
    items.filter((i) => i.kind === kind).reduce((s, i) => s + functionalItemAmount(i), 0);
  const curable = sum("curable");
  const incurable = sum("incurable");
  const total = Math.min(Math.max(0, available), curable + incurable);
  return { curable, incurable, total };
}

/* ---------- External obsolescence ---------- */

export type ExternalInput =
  | { mode: "percent"; pct: number }
  | { mode: "paired-rent"; rentWithout: number; rentWith: number; capRate: number };

/**
 * percent: pct x value remaining after physical and functional.
 * paired-rent: (monthly rent difference x 12) / cap rate, capped at value remaining.
 */
export function externalObsolescence(e: ExternalInput, remaining: number): number {
  const rem = Math.max(0, remaining);
  if (e.mode === "percent") return rem * clamp(e.pct, 0, 1);
  if (e.capRate <= 0) return 0;
  const raw = (Math.max(0, e.rentWithout - e.rentWith) * 12) / e.capRate;
  return Math.min(rem, raw);
}

/* ---------- Entrepreneurial incentive ---------- */

/** Incentive = pct x (RCN + land). Added after depreciation, not itself depreciated. */
export function entrepreneurialIncentive(rcn: number, land: number, pct: number): number {
  return Math.max(0, pct) * (rcn + Math.max(0, land));
}

/* ---------- Full estimate ---------- */

export interface EstimateInput {
  land: number;
  building: BuildingInput;
  effectiveAge: number;
  totalEconomicLife: number;
  curablePhysicalCost: number;
  functionalItems: FunctionalItem[];
  external: ExternalInput;
  incentivePct: number;
}

export interface Estimate {
  land: number;
  rcn: RcnResult;
  physical: PhysicalResult;
  functional: { curable: number; incurable: number; total: number };
  external: number;
  totalDepreciation: number;
  depreciatedImprovements: number;
  incentive: number;
  indicatedValue: number;
}

export function estimate(i: EstimateInput, t: CostTable): Estimate {
  const rcn = replacementCostNew(i.building, t);
  const physical = physicalDepreciation(rcn.rcn, i.effectiveAge, i.totalEconomicLife, i.curablePhysicalCost);
  const afterPhysical = rcn.rcn - physical.total;
  const functional = functionalObsolescence(i.functionalItems, afterPhysical);
  const external = externalObsolescence(i.external, afterPhysical - functional.total);
  const totalDepreciation = physical.total + functional.total + external;
  const depreciatedImprovements = rcn.rcn - totalDepreciation;
  const incentive = entrepreneurialIncentive(rcn.rcn, i.land, i.incentivePct);
  return {
    land: i.land,
    rcn,
    physical,
    functional,
    external,
    totalDepreciation,
    depreciatedImprovements,
    incentive,
    indicatedValue: i.land + depreciatedImprovements + incentive,
  };
}

/* ---------- Chart data ---------- */

export interface DepPoint {
  age: number;
  depreciation: number;
  depreciatedValue: number;
}

/** Physical depreciation for every whole year from 0 to TEL (curable part held constant). */
export function depreciationSeries(rcn: number, tel: number, curableCost = 0): DepPoint[] {
  const n = Math.max(1, Math.round(tel));
  const curable = clamp(curableCost, 0, rcn);
  const out: DepPoint[] = [];
  for (let age = 0; age <= n; age++) {
    const dep = curable + (rcn - curable) * ageLifeRate(age, n);
    out.push({ age, depreciation: dep, depreciatedValue: rcn - dep });
  }
  return out;
}

/* ---------- Market extraction of depreciation ---------- */

export interface Extraction {
  improvementValue: number;
  depreciation: number;
  /** Total depreciation as a fraction of RCN. May be negative if the sale exceeds cost new. */
  pct: number;
  /** pct per year of effective age (straight-line), or 0 when effective age is 0. */
  annualRate: number;
}

/**
 * Extract total depreciation from one improved sale:
 * (sale price - land value) = value of improvements; depreciation = RCN - that value.
 */
export function extractDepreciation(
  salePrice: number,
  landValue: number,
  rcn: number,
  effectiveAge: number,
): Extraction {
  const improvementValue = salePrice - landValue;
  const depreciation = rcn - improvementValue;
  const pct = rcn > 0 ? depreciation / rcn : 0;
  return { improvementValue, depreciation, pct, annualRate: effectiveAge > 0 ? pct / effectiveAge : 0 };
}

/** Remaining economic life = total economic life - effective age, never below zero. */
export function remainingEconomicLife(effectiveAge: number, totalEconomicLife: number): number {
  return Math.max(0, totalEconomicLife - effectiveAge);
}
