import type { Estimate } from "./calc";
import type { CostTable } from "./costTable";
import type { State } from "./state";

export interface Scenario {
  version: 1;
  state: State;
  table: CostTable;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Parse and check a saved scenario. Throws an Error with a plain message when it is not usable. */
export function parseScenario(text: string): Scenario {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  if (!isObj(raw) || raw["version"] !== 1) throw new Error("Not a cost-approach scenario (version 1).");
  const { state, table } = raw;
  if (!isObj(state) || !isObj(table)) throw new Error("Scenario is missing its state or cost table.");
  const must = ["gla", "tel", "effAge", "regional", "index", "buildingType", "quality", "comps", "func"];
  for (const k of must) if (!(k in state)) throw new Error(`Scenario is missing "${k}".`);
  if (!isObj(table["baseBuilding"]) || !isObj(table["quality"]) || !isObj(table["condition"])) {
    throw new Error("Scenario cost table is incomplete.");
  }
  if (!Array.isArray(state["comps"]) || !Array.isArray(state["func"])) throw new Error("Scenario lists are malformed.");
  return raw as unknown as Scenario;
}

export const scenarioJson = (s: Scenario): string => JSON.stringify(s, null, 2);

/** URL-safe base64 of the scenario, for a share link in the page hash. */
export function encodeShare(s: Scenario): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShare(hash: string): Scenario {
  const b64 = hash.replace(/^#s=/, "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return parseScenario(new TextDecoder().decode(bytes));
}

const csvCell = (v: string | number): string => {
  const t = String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Step-by-step breakdown as CSV rows: step, item, amount (dollars, rounded to cents). */
export function breakdownCsv(e: Estimate): string {
  const r = e.rcn;
  const c = (n: number) => Math.round(n * 100) / 100;
  const rows: [string, string, number][] = [
    ["1 Land", "Land value", e.land],
    ["2 Replacement cost new", "Base building", r.baseBuilding],
    ...r.features.map((f): [string, string, number] => ["2 Replacement cost new", f.name, f.amount]),
    ["2 Replacement cost new", "Direct cost", r.directCost],
    ["2 Replacement cost new", "After regional multiplier", r.afterRegional],
    ["2 Replacement cost new", "After current-cost index", r.afterIndex],
    ["2 Replacement cost new", "Indirect costs", r.indirectCosts],
    ["2 Replacement cost new", "Replacement cost new", r.rcn],
    ["3 Physical depreciation", "Curable", -e.physical.curable],
    ["3 Physical depreciation", "Incurable (age-life)", -e.physical.incurable],
    ["4 Functional obsolescence", "Total", -e.functional.total],
    ["5 External obsolescence", "Total", -e.external],
    ["Total depreciation", "Total", -e.totalDepreciation],
    ["Depreciated improvements", "RCN less depreciation", e.depreciatedImprovements],
    ["6 Entrepreneurial incentive", "Total", e.incentive],
    ["Indicated value", "Land + improvements + incentive", e.indicatedValue],
  ];
  return ["step,item,amount", ...rows.map(([a, b, n]) => [a, b, c(n)].map(csvCell).join(","))].join("\r\n") + "\r\n";
}
