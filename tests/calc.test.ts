import { describe, expect, it } from "vitest";
import {
  ageLifeRate,
  depreciationSeries,
  entrepreneurialIncentive,
  estimate,
  externalObsolescence,
  functionalItemAmount,
  functionalObsolescence,
  landFromComps,
  median,
  physicalDepreciation,
  replacementCostNew,
  suggestEffectiveAge,
  type BuildingInput,
  type EstimateInput,
} from "../src/calc";
import { SAMPLE_TABLE } from "../src/costTable";

// Worked example, checked by hand:
// Ranch 1,500 sf, Average (x1.00) at $100/sf            = 150,000
// Garage 400 x 40 = 16,000; Porch 100 x 30 = 3,000;
// Basement unfinished 1,000 x 25 = 25,000; HVAC 1,500 x 8 = 12,000 -> features 56,000
// Direct = 206,000; x 1.05 regional = 216,300; x 1.10 index = 237,930
const building: BuildingInput = {
  buildingType: "Ranch (1 story)",
  quality: "Average",
  glaSqFt: 1500,
  garageSqFt: 400,
  porchSqFt: 100,
  basementSqFt: 1000,
  basementFinished: false,
  centralHvac: true,
  regionalMultiplier: 1.05,
  costIndex: 1.1,
};

describe("land", () => {
  it("median of odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([])).toBe(0);
  });
  it("land from comps: $/sf 2.00, 2.20, 2.50 -> median 2.20 x 18,000 = 39,600", () => {
    const r = landFromComps(
      [
        { price: 20000, areaSqFt: 10000 },
        { price: 33000, areaSqFt: 15000 },
        { price: 37500, areaSqFt: 15000 },
      ],
      18000,
    );
    expect(r.perSqFt).toBeCloseTo(2.2, 10);
    expect(r.value).toBeCloseTo(39600, 6);
  });
  it("ignores comps with no area or price", () => {
    const r = landFromComps([{ price: 10000, areaSqFt: 0 }, { price: 0, areaSqFt: 5000 }], 1000);
    expect(r.value).toBe(0);
  });
});

describe("replacement cost new", () => {
  it("matches the hand-checked example", () => {
    const r = replacementCostNew(building, SAMPLE_TABLE);
    expect(r.baseBuilding).toBe(150000);
    expect(r.featuresTotal).toBe(56000);
    expect(r.directCost).toBe(206000);
    expect(r.afterRegional).toBeCloseTo(216300, 6);
    expect(r.rcn).toBeCloseTo(237930, 6);
  });
  it("applies the quality multiplier to the base building only", () => {
    const r = replacementCostNew({ ...building, quality: "Good" }, SAMPLE_TABLE);
    expect(r.baseBuilding).toBeCloseTo(180000, 6); // 1,500 x 100 x 1.20
    expect(r.featuresTotal).toBe(56000);
  });
  it("finished basement uses the finished rate: 1,000 x 55 = 55,000", () => {
    const r = replacementCostNew({ ...building, basementFinished: true }, SAMPLE_TABLE);
    expect(r.features[2]?.amount).toBe(55000);
  });
  it("no HVAC removes only the HVAC line", () => {
    const r = replacementCostNew({ ...building, centralHvac: false }, SAMPLE_TABLE);
    expect(r.featuresTotal).toBe(44000);
  });
  it("adds indirect costs when the table sets a percentage", () => {
    const r = replacementCostNew(building, { ...SAMPLE_TABLE, indirectPct: 0.1 });
    expect(r.indirectCosts).toBeCloseTo(23793, 6);
    expect(r.rcn).toBeCloseTo(261723, 6);
  });
  it("treats negative sizes as zero", () => {
    const r = replacementCostNew({ ...building, glaSqFt: -5, garageSqFt: -1 }, SAMPLE_TABLE);
    expect(r.baseBuilding).toBe(0);
    expect(r.features[0]?.amount).toBe(0);
  });
});

describe("physical depreciation (age-life)", () => {
  it("rate = effective age / TEL: 15 / 60 = 0.25", () => {
    expect(ageLifeRate(15, 60)).toBe(0.25);
  });
  it("rate is held between 0 and 1", () => {
    expect(ageLifeRate(90, 60)).toBe(1);
    expect(ageLifeRate(-5, 60)).toBe(0);
    expect(ageLifeRate(10, 0)).toBe(1);
  });
  it("suggested effective age: 40 yr x 0.75 = 30; capped at TEL", () => {
    expect(suggestEffectiveAge(40, 0.75, 60)).toBe(30);
    expect(suggestEffectiveAge(50, 1.6, 60)).toBe(60);
  });
  it("splits curable and incurable: 237,930, cure 5,000, rate 0.25", () => {
    const p = physicalDepreciation(237930, 15, 60, 5000);
    expect(p.curable).toBe(5000);
    expect(p.incurable).toBeCloseTo(58232.5, 6); // (237,930 - 5,000) x 0.25
    expect(p.total).toBeCloseTo(63232.5, 6);
  });
  it("caps curable cost at RCN", () => {
    const p = physicalDepreciation(10000, 20, 60, 50000);
    expect(p.curable).toBe(10000);
    expect(p.incurable).toBe(0);
  });
});

describe("functional obsolescence", () => {
  it("curable = cost to cure; incurable = annual loss / cap rate", () => {
    expect(functionalItemAmount({ kind: "curable", name: "x", costToCure: 3000 })).toBe(3000);
    expect(functionalItemAmount({ kind: "incurable", name: "y", annualLoss: 600, capRate: 0.1 })).toBeCloseTo(6000, 6);
  });
  it("zero cap rate gives zero, not infinity", () => {
    expect(functionalItemAmount({ kind: "incurable", name: "y", annualLoss: 600, capRate: 0 })).toBe(0);
  });
  it("totals and caps at the value available", () => {
    const items = [
      { kind: "curable", name: "a", costToCure: 3000 },
      { kind: "incurable", name: "b", annualLoss: 600, capRate: 0.1 },
    ] as const;
    const r = functionalObsolescence([...items], 100000);
    expect(r.curable).toBe(3000);
    expect(r.incurable).toBeCloseTo(6000, 6);
    expect(r.total).toBeCloseTo(9000, 6);
    expect(functionalObsolescence([...items], 4000).total).toBe(4000);
  });
});

describe("external obsolescence", () => {
  it("percent: 5% x 165,697.50 = 8,284.875", () => {
    expect(externalObsolescence({ mode: "percent", pct: 0.05 }, 165697.5)).toBeCloseTo(8284.875, 6);
  });
  it("paired rent: (1,200 - 1,150) x 12 / 0.08 = 7,500", () => {
    const e = { mode: "paired-rent", rentWithout: 1200, rentWith: 1150, capRate: 0.08 } as const;
    expect(externalObsolescence(e, 100000)).toBeCloseTo(7500, 6);
  });
  it("paired rent is capped at value remaining", () => {
    const e = { mode: "paired-rent", rentWithout: 1200, rentWith: 1150, capRate: 0.08 } as const;
    expect(externalObsolescence(e, 5000)).toBe(5000);
  });
  it("paired rent: with-rent above without-rent gives zero", () => {
    const e = { mode: "paired-rent", rentWithout: 1000, rentWith: 1100, capRate: 0.08 } as const;
    expect(externalObsolescence(e, 100000)).toBe(0);
  });
});

describe("entrepreneurial incentive", () => {
  it("10% x (237,930 + 40,000) = 27,793", () => {
    expect(entrepreneurialIncentive(237930, 40000, 0.1)).toBeCloseTo(27793, 6);
  });
  it("negative pct gives zero", () => {
    expect(entrepreneurialIncentive(1000, 1000, -0.1)).toBe(0);
  });
});

describe("full estimate", () => {
  const input: EstimateInput = {
    land: 40000,
    building,
    effectiveAge: 15,
    totalEconomicLife: 60,
    curablePhysicalCost: 5000,
    functionalItems: [
      { kind: "curable", name: "Outdated wiring", costToCure: 3000 },
      { kind: "incurable", name: "Poor floor plan", annualLoss: 600, capRate: 0.1 },
    ],
    external: { mode: "percent", pct: 0.05 },
    incentivePct: 0.1,
  };
  it("matches the hand-checked chain", () => {
    const e = estimate(input, SAMPLE_TABLE);
    expect(e.rcn.rcn).toBeCloseTo(237930, 6);
    expect(e.physical.total).toBeCloseTo(63232.5, 6);
    expect(e.functional.total).toBeCloseTo(9000, 6);
    // 237,930 - 63,232.5 - 9,000 = 165,697.5 remaining; x 5% = 8,284.875
    expect(e.external).toBeCloseTo(8284.875, 6);
    expect(e.totalDepreciation).toBeCloseTo(80517.375, 6);
    expect(e.depreciatedImprovements).toBeCloseTo(157412.625, 6);
    expect(e.incentive).toBeCloseTo(27793, 6);
    // 40,000 + 157,412.625 + 27,793
    expect(e.indicatedValue).toBeCloseTo(225205.625, 6);
  });
  it("brand-new building, no obsolescence, no incentive: value = land + RCN", () => {
    const e = estimate(
      { ...input, effectiveAge: 0, curablePhysicalCost: 0, functionalItems: [], external: { mode: "percent", pct: 0 }, incentivePct: 0 },
      SAMPLE_TABLE,
    );
    expect(e.indicatedValue).toBeCloseTo(40000 + 237930, 6);
  });
});

describe("depreciation series", () => {
  it("TEL 50, RCN 100,000: age 0 = 0, age 25 = 50,000, age 50 = 100,000", () => {
    const s = depreciationSeries(100000, 50);
    expect(s).toHaveLength(51);
    expect(s[0]?.depreciation).toBe(0);
    expect(s[25]?.depreciation).toBeCloseTo(50000, 6);
    expect(s[50]?.depreciatedValue).toBeCloseTo(0, 6);
  });
  it("curable amount is held constant: cure 10,000, age 25 -> 10,000 + 90,000 x 0.5 = 55,000", () => {
    const s = depreciationSeries(100000, 50, 10000);
    expect(s[0]?.depreciation).toBe(10000);
    expect(s[25]?.depreciation).toBeCloseTo(55000, 6);
  });
});
