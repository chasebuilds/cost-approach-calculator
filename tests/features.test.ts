import { describe, expect, it } from "vitest";
import { estimate, extractDepreciation, remainingEconomicLife } from "../src/calc";
import { SAMPLE_TABLE } from "../src/costTable";
import { breakdownCsv, decodeShare, encodeShare, parseScenario, scenarioJson, type Scenario } from "../src/io";
import { defaults } from "../src/state";

const scenario = (): Scenario => ({ version: 1, state: defaults(), table: structuredClone(SAMPLE_TABLE) });

describe("market extraction of depreciation", () => {
  it("215,000 sale, 38,000 land, 235,000 RCN: improvements 177,000, depreciation 58,000", () => {
    const x = extractDepreciation(215000, 38000, 235000, 14);
    expect(x.improvementValue).toBe(177000);
    expect(x.depreciation).toBe(58000);
    expect(x.pct).toBeCloseTo(58000 / 235000, 10); // 24.68%
    expect(x.annualRate).toBeCloseTo(58000 / 235000 / 14, 10); // 1.76% per year
  });
  it("sale above cost new gives negative depreciation", () => {
    const x = extractDepreciation(300000, 40000, 200000, 5);
    expect(x.depreciation).toBe(-60000);
    expect(x.pct).toBeCloseTo(-0.3, 10);
  });
  it("zero RCN and zero effective age do not divide by zero", () => {
    const x = extractDepreciation(100000, 50000, 0, 0);
    expect(x.pct).toBe(0);
    expect(x.annualRate).toBe(0);
  });
});

describe("remaining economic life", () => {
  it("60 - 15 = 45", () => expect(remainingEconomicLife(15, 60)).toBe(45));
  it("never below zero", () => expect(remainingEconomicLife(70, 60)).toBe(0));
});

describe("scenario save and load", () => {
  it("round trips through JSON", () => {
    const s = scenario();
    const back = parseScenario(scenarioJson(s));
    expect(back.state.gla).toBe(1500);
    expect(back.table.baseBuilding["Ranch (1 story)"]).toBe(100);
  });
  it("round trips through a share link, including non-ASCII text", () => {
    const s = scenario();
    s.state.func.push({ kind: "curable", name: "Café \"patio\", step & rail", costToCure: 750 });
    const back = decodeShare("#s=" + encodeShare(s));
    expect(back.state.func.at(-1)).toEqual({ kind: "curable", name: "Café \"patio\", step & rail", costToCure: 750 });
  });
  it("share links are URL-safe", () => {
    expect(encodeShare(scenario())).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("rejects bad input with a plain message", () => {
    expect(() => parseScenario("{nope")).toThrow("not valid JSON");
    expect(() => parseScenario("[]")).toThrow("version 1");
    expect(() => parseScenario('{"version":2}')).toThrow("version 1");
    expect(() => parseScenario('{"version":1,"state":{},"table":{}}')).toThrow('missing "gla"');
  });
  it("rejects a scenario with an incomplete cost table", () => {
    const raw = JSON.parse(scenarioJson(scenario()));
    delete raw.table.quality;
    expect(() => parseScenario(JSON.stringify(raw))).toThrow("incomplete");
  });
});

describe("CSV export", () => {
  const input = () => {
    const s = defaults();
    return estimate(
      {
        land: s.landValue,
        building: {
          buildingType: s.buildingType, quality: s.quality, glaSqFt: s.gla, garageSqFt: s.garage,
          porchSqFt: s.porch, basementSqFt: s.basement, basementFinished: s.basementFinished,
          centralHvac: s.hvac, regionalMultiplier: s.regional, costIndex: s.index,
        },
        effectiveAge: s.effAge, totalEconomicLife: s.tel, curablePhysicalCost: s.curablePhys,
        functionalItems: s.func, external: { mode: "percent", pct: s.extPct / 100 }, incentivePct: s.incentive / 100,
      },
      SAMPLE_TABLE,
    );
  };
  it("has a header and the hand-checked totals", () => {
    const csv = breakdownCsv(input());
    expect(csv.startsWith("step,item,amount\r\n")).toBe(true);
    expect(csv).toContain("Replacement cost new,Replacement cost new,237930");
    expect(csv).toMatch(/Total depreciation,Total,-80517.3[78]/); // 80,517.375 sits on a half-cent
    expect(csv).toMatch(/Indicated value,Land \+ improvements \+ incentive,225205\.6[23]\r\n$/);
  });
  it("shows depreciation as negative amounts", () => {
    expect(breakdownCsv(input())).toContain("3 Physical depreciation,Curable,-5000");
  });
});
