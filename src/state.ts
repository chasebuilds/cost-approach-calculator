import type { FunctionalItem, LandComp } from "./calc";

export interface State {
  landMode: "entered" | "comps";
  landValue: number;
  landArea: number;
  comps: LandComp[];
  buildingType: string;
  quality: string;
  condition: string;
  gla: number;
  garage: number;
  porch: number;
  basement: number;
  basementFinished: boolean;
  hvac: boolean;
  regional: number;
  index: number;
  actualAge: number;
  tel: number;
  effAge: number;
  curablePhys: number;
  func: FunctionalItem[];
  extMode: "percent" | "paired-rent";
  extPct: number;
  rentWithout: number;
  rentWith: number;
  extCap: number;
  incentive: number;
  saleOn: boolean;
  salePrice: number;
  saleLand: number;
  saleRcn: number;
  saleEffAge: number;
}

export const defaults = (): State => ({
  landMode: "entered",
  landValue: 40000,
  landArea: 18000,
  comps: [
    { price: 20000, areaSqFt: 10000 },
    { price: 33000, areaSqFt: 15000 },
    { price: 37500, areaSqFt: 15000 },
  ],
  buildingType: "Ranch (1 story)",
  quality: "Average",
  condition: "Good",
  gla: 1500,
  garage: 400,
  porch: 100,
  basement: 1000,
  basementFinished: false,
  hvac: true,
  regional: 1.05,
  index: 1.1,
  actualAge: 20,
  tel: 60,
  effAge: 15,
  curablePhys: 5000,
  func: [
    { kind: "curable", name: "Outdated wiring (sample)", costToCure: 3000 },
    { kind: "incurable", name: "Poor floor plan (sample)", annualLoss: 600, capRate: 0.1 },
  ],
  extMode: "percent",
  extPct: 5,
  rentWithout: 1200,
  rentWith: 1150,
  extCap: 8,
  incentive: 10,
  saleOn: false,
  salePrice: 215000,
  saleLand: 38000,
  saleRcn: 235000,
  saleEffAge: 14,
});
