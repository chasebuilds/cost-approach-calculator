/**
 * ILLUSTRATIVE PLACEHOLDER FIGURES. Not from a licensed cost service
 * (Marshall & Swift, RSMeans, etc.). Replace with your own local data.
 */
export interface CostTable {
  label: string;
  /** Base $ per sq ft of gross living area, by building type (average quality). */
  baseBuilding: Record<string, number>;
  /** Multiplier applied to the base building cost, by quality grade. */
  quality: Record<string, number>;
  /** Suggested effective-age ratio (effective age / actual age), by condition grade. */
  condition: Record<string, number>;
  garagePerSqFt: number;
  porchPerSqFt: number;
  basementUnfinishedPerSqFt: number;
  basementFinishedPerSqFt: number;
  hvacCentralPerSqFtGla: number;
  /** Indirect costs (permits, design, financing) as a fraction of the indexed direct cost. */
  indirectPct: number;
}

export const SAMPLE_TABLE: CostTable = {
  label: "Sample placeholder table (not a licensed cost service)",
  baseBuilding: {
    "Ranch (1 story)": 100,
    "Two-story": 90,
    "Split-level": 95,
    Manufactured: 60,
  },
  quality: { Low: 0.75, Fair: 0.9, Average: 1.0, Good: 1.2, Excellent: 1.5 },
  condition: { Excellent: 0.5, Good: 0.75, Average: 1.0, Fair: 1.3, Poor: 1.6 },
  garagePerSqFt: 40,
  porchPerSqFt: 30,
  basementUnfinishedPerSqFt: 25,
  basementFinishedPerSqFt: 55,
  hvacCentralPerSqFtGla: 8,
  indirectPct: 0,
};
