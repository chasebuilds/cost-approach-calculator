import "./style.css";
import {
  depreciationSeries,
  estimate,
  extractDepreciation,
  remainingEconomicLife,
  functionalItemAmount,
  landFromComps,
  suggestEffectiveAge,
  type EstimateInput,
} from "./calc";
import { depreciationChart } from "./chart";
import { SAMPLE_TABLE, type CostTable } from "./costTable";
import { breakdownCsv, decodeShare, encodeShare, parseScenario, scenarioJson } from "./io";
import { defaults, type State } from "./state";

let s = defaults();
let table: CostTable = structuredClone(SAMPLE_TABLE);

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const esc = (t: string): string =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const usd = (n: number): string =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num = (v: string): number => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);

type Key = keyof State;

/* ---------- form binding ---------- */

function fillSelect(id: string, options: string[], value: string): void {
  const el = $<HTMLSelectElement>(id);
  el.innerHTML = options.map((o) => `<option>${esc(o)}</option>`).join("");
  el.value = options.includes(value) ? value : (options[0] ?? "");
}

function syncForm(): void {
  fillSelect("selType", Object.keys(table.baseBuilding), s.buildingType);
  fillSelect("selQuality", Object.keys(table.quality), s.quality);
  fillSelect("selCondition", Object.keys(table.condition), s.condition);
  s.buildingType = $<HTMLSelectElement>("selType").value;
  s.quality = $<HTMLSelectElement>("selQuality").value;
  s.condition = $<HTMLSelectElement>("selCondition").value;
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-k]").forEach((el) => {
    const k = el.dataset["k"] as Key;
    const v = s[k];
    if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = Boolean(v);
    else if (typeof v === "string" || typeof v === "number") el.value = String(v);
  });
  renderComps();
  renderFunc();
  renderTable();
  toggles();
}

function toggles(): void {
  $("landEntered").hidden = s.landMode !== "entered";
  $("landComps").hidden = s.landMode !== "comps";
  $("extPercent").hidden = s.extMode !== "percent";
  $("extRent").hidden = s.extMode !== "paired-rent";
}

function onInput(e: Event): void {
  const el = e.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
  const k = el.dataset["k"] as Key | undefined;
  if (!k) return;
  const rec = s as unknown as Record<string, unknown>;
  if (el instanceof HTMLInputElement && el.type === "checkbox") rec[k] = el.checked;
  else if (typeof s[k] === "number") rec[k] = num(el.value);
  else rec[k] = el.value;
  toggles();
  render();
}

/* ---------- dynamic lists ---------- */

function renderComps(): void {
  $("compRows").innerHTML = s.comps
    .map(
      (c, i) => `<div class="row">
      <label>Sale price ($) <input type="number" min="0" step="500" data-comp="${i}" data-f="price" value="${c.price}"></label>
      <label>Lot (sq ft) <input type="number" min="0" step="100" data-comp="${i}" data-f="areaSqFt" value="${c.areaSqFt}"></label>
      <button type="button" class="small" data-del-comp="${i}" aria-label="Remove comp ${i + 1}">Remove</button></div>`,
    )
    .join("");
}

function renderFunc(): void {
  $("funcRows").innerHTML = s.func
    .map((f, i) => {
      const name = `<label>Item <input type="text" data-func="${i}" data-f="name" value="${esc(f.name)}"></label>`;
      const body =
        f.kind === "curable"
          ? `<label>Cost to cure ($) <input type="number" min="0" step="100" data-func="${i}" data-f="costToCure" value="${f.costToCure}"></label>`
          : `<label>Annual rent loss ($) <input type="number" min="0" step="50" data-func="${i}" data-f="annualLoss" value="${f.annualLoss}"></label>
             <label>Cap rate (%) <input type="number" min="0.1" step="0.1" data-func="${i}" data-f="capRate" value="${f.capRate * 100}"></label>`;
      return `<div class="row"><span class="tag">${f.kind}</span>${name}${body}
        <button type="button" class="small" data-del-func="${i}" aria-label="Remove item ${i + 1}">Remove</button></div>`;
    })
    .join("");
}

function tableInput(path: string, value: number, step: string): string {
  return `<input type="number" min="0" step="${step}" data-t="${esc(path)}" value="${value}">`;
}

function renderTable(): void {
  $("tableLabel").textContent = table.label;
  const group = (title: string, rec: Record<string, number>, prefix: string, step: string) =>
    `<h3>${title}</h3>` +
    Object.entries(rec)
      .map(([k, v]) => `<label>${esc(k)} ${tableInput(`${prefix}.${k}`, v, step)}</label>`)
      .join("");
  const one = (label: string, key: keyof CostTable, step: string) =>
    `<label>${label} ${tableInput(String(key), table[key] as number, step)}</label>`;
  $("tableRows").innerHTML =
    group("Base building cost, $ per sq ft GLA (Average quality)", table.baseBuilding, "baseBuilding", "1") +
    group("Quality multipliers", table.quality, "quality", "0.01") +
    group("Condition: effective-age ratio", table.condition, "condition", "0.05") +
    "<h3>Features and indirect costs</h3>" +
    one("Garage $/sq ft", "garagePerSqFt", "1") +
    one("Porch $/sq ft", "porchPerSqFt", "1") +
    one("Basement unfinished $/sq ft", "basementUnfinishedPerSqFt", "1") +
    one("Basement finished $/sq ft", "basementFinishedPerSqFt", "1") +
    one("Central HVAC $/sq ft GLA", "hvacCentralPerSqFtGla", "0.5") +
    one("Indirect costs (fraction, 0.10 = 10%)", "indirectPct", "0.01");
}

function onListInput(e: Event): void {
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  const f = el.dataset["f"];
  if (el.dataset["comp"] !== undefined && f) {
    const c = s.comps[Number(el.dataset["comp"])];
    if (c) (c as unknown as Record<string, number>)[f] = num(el.value);
  } else if (el.dataset["func"] !== undefined && f) {
    const item = s.func[Number(el.dataset["func"])];
    if (!item) return;
    const rec = item as unknown as Record<string, unknown>;
    if (f === "name") rec[f] = el.value;
    else rec[f] = f === "capRate" ? num(el.value) / 100 : num(el.value);
  } else if (el.dataset["t"]) {
    const [a, b] = el.dataset["t"].split(/\.(.+)/);
    const t = table as unknown as Record<string, number | Record<string, number>>;
    const group = a ? t[a] : undefined;
    if (a && b && typeof group === "object") group[b] = num(el.value);
    else if (a) t[a] = num(el.value);
  } else return;
  render();
}

function onListClick(e: Event): void {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;
  if (el.dataset["delComp"] !== undefined) {
    s.comps.splice(Number(el.dataset["delComp"]), 1);
    renderComps();
  } else if (el.dataset["delFunc"] !== undefined) {
    s.func.splice(Number(el.dataset["delFunc"]), 1);
    renderFunc();
  } else return;
  render();
}

/* ---------- results ---------- */

function buildInput(): EstimateInput {
  const land = s.landMode === "comps" ? landFromComps(s.comps, s.landArea).value : s.landValue;
  return {
    land,
    building: {
      buildingType: s.buildingType,
      quality: s.quality,
      glaSqFt: s.gla,
      garageSqFt: s.garage,
      porchSqFt: s.porch,
      basementSqFt: s.basement,
      basementFinished: s.basementFinished,
      centralHvac: s.hvac,
      regionalMultiplier: s.regional,
      costIndex: s.index,
    },
    effectiveAge: s.effAge,
    totalEconomicLife: s.tel,
    curablePhysicalCost: s.curablePhys,
    functionalItems: s.func,
    external:
      s.extMode === "percent"
        ? { mode: "percent", pct: s.extPct / 100 }
        : { mode: "paired-rent", rentWithout: s.rentWithout, rentWith: s.rentWith, capRate: s.extCap / 100 },
    incentivePct: s.incentive / 100,
  };
}

const row = (label: string, amount: string, note = "", cls = ""): string =>
  `<tr class="${cls}"><td>${label}${note ? `<small>${note}</small>` : ""}</td><td class="amt">${amount}</td></tr>`;

function render(): void {
  const input = buildInput();
  const e = estimate(input, table);
  const r = e.rcn;
  const comps = landFromComps(s.comps, s.landArea);
  const landNote =
    s.landMode === "comps"
      ? `median comp ${comps.perSqFt.toFixed(2)} $/sq ft x ${s.landArea.toLocaleString("en-US")} sq ft`
      : "entered";
  const feat = r.features.filter((f) => f.amount > 0).map((f) => row(`${f.name}`, usd(f.amount), "", "sub"));
  const funcRows = s.func.map((f) =>
    row(
      `${esc(f.name)} (${f.kind})`,
      usd(functionalItemAmount(f)),
      f.kind === "incurable" ? `${usd(f.annualLoss)} per year / ${(f.capRate * 100).toFixed(1)}% cap rate` : "cost to cure",
      "sub",
    ),
  );
  const extNote =
    s.extMode === "percent"
      ? `${s.extPct}% of value remaining after steps 3 and 4`
      : `(${usd(s.rentWithout)} - ${usd(s.rentWith)}) x 12 / ${s.extCap}% cap rate, capped at value remaining`;
  const ex = extractDepreciation(s.salePrice, s.saleLand, s.saleRcn, s.saleEffAge);
  const modelPct = r.rcn > 0 ? e.totalDepreciation / r.rcn : 0;
  const marketCard = s.saleOn
    ? `<section class="card result"><h2>Market check</h2>
      <p class="hint">Sale price ${usd(s.salePrice)} - land ${usd(s.saleLand)} = ${usd(ex.improvementValue)} for improvements. Cost new ${usd(s.saleRcn)}.</p>
      <table class="steps">
        ${row("Depreciation implied by the sale", usd(ex.depreciation), `${(ex.pct * 100).toFixed(1)}% of cost new${ex.annualRate ? `, ${(ex.annualRate * 100).toFixed(2)}% per year of effective age` : ""}`, "total")}
        ${row("Depreciation in this estimate", usd(e.totalDepreciation), `${(modelPct * 100).toFixed(1)}% of cost new`, "total")}
        ${row("Gap (estimate minus market)", `${((modelPct - ex.pct) * 100).toFixed(1)} pts`, "percentage points of cost new", "sub")}
      </table></section>`
    : "";
  const series = depreciationSeries(r.rcn, s.tel, e.physical.curable);

  $("results").innerHTML = `
    <section class="card result">
      <div class="print-only notice"><strong>Analysis and education tool, not an appraisal.</strong> A USPAP-compliant appraisal requires a licensed or certified appraiser. Unit costs are placeholder figures.</div>
      <h2>Indicated value by the cost approach</h2>
      <p class="big">${usd(e.indicatedValue)}</p>
      <p class="hint">Land ${usd(e.land)} + depreciated improvements ${usd(e.depreciatedImprovements)} + entrepreneurial incentive ${usd(e.incentive)}</p>
      <p class="hint print-only">Subject: ${esc(s.buildingType)}, ${s.quality} quality, ${s.gla.toLocaleString("en-US")} sq ft GLA, actual age ${s.actualAge}, effective age ${s.effAge}, TEL ${s.tel}. Printed ${new Date().toLocaleDateString("en-US")}.</p>
      <table class="steps">
        ${row("1. Land value", usd(e.land), landNote, "step")}
        ${row("2. Replacement cost new", "", "", "step")}
        ${row(`Base building`, usd(r.baseBuilding), `${s.gla.toLocaleString("en-US")} sq ft x $${r.baseUnitCost}/sq ft x ${r.qualityMultiplier} quality`, "sub")}
        ${feat.join("")}
        ${row("Direct cost", usd(r.directCost), "", "sub")}
        ${row("After regional multiplier", usd(r.afterRegional), `x ${s.regional}`, "sub")}
        ${row("After current-cost index", usd(r.afterIndex), `x ${s.index}`, "sub")}
        ${r.indirectCosts > 0 ? row("Indirect costs", usd(r.indirectCosts), `${(table.indirectPct * 100).toFixed(1)}% of indexed cost`, "sub") : ""}
        ${row("Replacement cost new", usd(r.rcn), "", "total")}
        ${row("3. Physical depreciation", "", "", "step")}
        ${row("Curable (deferred maintenance)", `(${usd(e.physical.curable)})`, "cost to cure", "sub")}
        ${row("Incurable (age-life)", `(${usd(e.physical.incurable)})`, `(RCN - curable) x ${s.effAge} / ${s.tel} = ${(e.physical.rate * 100).toFixed(1)}%; remaining economic life ${remainingEconomicLife(s.effAge, s.tel)} yr`, "sub")}
        ${row("Total physical", `(${usd(e.physical.total)})`, "", "total")}
        ${row("4. Functional obsolescence", `(${usd(e.functional.total)})`, "", "step")}
        ${funcRows.join("")}
        ${row("5. External obsolescence", `(${usd(e.external)})`, extNote, "step")}
        ${row("Total depreciation", `(${usd(e.totalDepreciation)})`, "", "total")}
        ${row("Depreciated cost of improvements", usd(e.depreciatedImprovements), "RCN - total depreciation", "total")}
        ${row("6. Entrepreneurial incentive", usd(e.incentive), `${s.incentive}% x (RCN + land)`, "step")}
        ${row("Indicated value (cost approach)", usd(e.indicatedValue), "land + depreciated improvements + incentive", "grand")}
      </table>
    </section>
    <section class="card result">
      <h2>Depreciation over age</h2>
      ${depreciationChart(series, s.effAge)}
      <p class="hint">Physical depreciation only (age-life method); curable amount held constant.</p>
    </section>${marketCard}`;
}

/* ---------- wiring ---------- */

function init(): void {
  if (location.hash.startsWith("#s=")) {
    try {
      const sc = decodeShare(location.hash);
      s = { ...defaults(), ...sc.state };
      table = sc.table;
    } catch {
      /* bad link: fall back to the sample data */
    }
  }
  syncForm();
  const form = $("inputs");
  form.addEventListener("input", (e) => {
    onInput(e);
    onListInput(e);
  });
  form.addEventListener("change", (e) => {
    if (e.target instanceof HTMLSelectElement) onInput(e);
  });
  form.addEventListener("click", onListClick);
  $("addComp").addEventListener("click", () => {
    s.comps.push({ price: 0, areaSqFt: 0 });
    renderComps();
    render();
  });
  $("addFuncCurable").addEventListener("click", () => {
    s.func.push({ kind: "curable", name: "New item", costToCure: 0 });
    renderFunc();
    render();
  });
  $("addFuncIncurable").addEventListener("click", () => {
    s.func.push({ kind: "incurable", name: "New item", annualLoss: 0, capRate: 0.1 });
    renderFunc();
    render();
  });
  $("suggestAge").addEventListener("click", () => {
    s.effAge = Math.round(suggestEffectiveAge(s.actualAge, table.condition[s.condition] ?? 1, s.tel));
    const ea = form.querySelector<HTMLInputElement>('[data-k="effAge"]');
    if (ea) ea.value = String(s.effAge);
    render();
    // Say what happened, even when the suggestion matches what was already there.
    const btn = $("suggestAge");
    btn.textContent = `Set to ${s.effAge} years`;
    ea?.animate([{ boxShadow: "0 0 0 3px #f2c27a" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 900 });
    setTimeout(() => { btn.textContent = "Suggest from condition"; }, 1600);
  });
  const download = (name: string, text: string, type: string): void => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const scenarioNow = () => ({ version: 1 as const, state: s, table });
  const load = (sc: { state: State; table: CostTable }): void => {
    s = { ...defaults(), ...sc.state };
    table = sc.table;
    syncForm();
    render();
  };
  $("saveJson").addEventListener("click", () => download("cost-approach-scenario.json", scenarioJson(scenarioNow()), "application/json"));
  $("exportCsv").addEventListener("click", () => download("cost-approach-breakdown.csv", breakdownCsv(estimate(buildInput(), table)), "text/csv"));
  $("loadJson").addEventListener("click", () => $<HTMLInputElement>("fileIn").click());
  $<HTMLInputElement>("fileIn").addEventListener("change", (ev) => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      try {
        load(parseScenario(text));
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not load that file.");
      }
      input.value = "";
    });
  });
  $("shareLink").addEventListener("click", () => {
    const url = `${location.origin}${location.pathname}#s=${encodeShare(scenarioNow())}`;
    history.replaceState(null, "", url);
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    $("shareLink").textContent = "Link copied";
    setTimeout(() => ($("shareLink").textContent = "Copy share link"), 1800);
  });
  $("print").addEventListener("click", () => window.print());
  $("reset").addEventListener("click", () => {
    s = defaults();
    table = structuredClone(SAMPLE_TABLE);
    syncForm();
    render();
  });
  render();
}

init();
