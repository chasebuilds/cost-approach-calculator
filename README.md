# Cost Approach Calculator

[![CI](https://github.com/chasebuilds/cost-approach-calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/chasebuilds/cost-approach-calculator/actions/workflows/ci.yml)

**Live demo: https://chasebuilds.github.io/cost-approach-calculator/**

A static web app for the cost approach to value. Enter land, a building and its depreciation, and it shows every step from replacement cost new to an indicated value, plus a depreciation chart and a one-page print summary.

> **This is an analysis and education tool, not an appraisal.** A USPAP-compliant appraisal requires a licensed or certified appraiser. The unit costs that ship with the app are **made-up placeholder figures**, not a licensed cost service. All default data is synthetic.

![Screenshot](docs/screenshot.png)

## What it does

1. **Land**: enter a value, or enter land comps (price and lot size) and use the median $/sq ft times the subject lot.
2. **Replacement cost new**: base cost per sq ft by building type and quality grade, plus garage, porch, basement (finished or not) and central HVAC, then a regional multiplier and a current-cost index. Optional indirect costs. The unit-cost table is shown in the page and editable.
3. **Physical depreciation**: age-life method (effective age / total economic life), split into curable (deferred maintenance at cost to cure) and incurable (the rest, depreciated by the age-life rate). A condition grade can suggest an effective age.
4. **Functional obsolescence**: entered items. Curable items use cost to cure. Incurable items capitalize a yearly rent loss at a cap rate.
5. **External obsolescence**: an entered percent of the value remaining, or paired-rent capitalization (monthly rent difference x 12 / cap rate).
6. **Entrepreneurial incentive**: a percent of (replacement cost new + land).
7. A step-by-step breakdown, a chart of depreciation over age, and a print layout that fits one page.

## Formulas

| Step | Formula |
|---|---|
| Replacement cost new | `(GLA x base $/sf x quality + features) x regional x index`, plus indirect costs |
| Age-life rate | `min(1, effective age / total economic life)` |
| Curable physical | `min(cost to cure, RCN)` |
| Incurable physical | `(RCN - curable) x age-life rate` |
| Functional, incurable item | `annual loss / cap rate` |
| External, percent | `pct x (RCN - physical - functional)` |
| External, paired rent | `min(remaining, (rent without - rent with) x 12 / cap rate)` |
| Entrepreneurial incentive | `pct x (RCN + land)`, added after depreciation, not depreciated |
| Indicated value | `land + (RCN - total depreciation) + incentive` |

Worked example used in the tests (all hand-checked): ranch, 1,500 sq ft, average quality, features $56,000, x1.05 x1.10 gives RCN $237,930. Effective age 15 of 60 with $5,000 deferred maintenance gives physical $63,232.50. Functional $9,000, external 5% gives $8,284.88. Land $40,000 and 10% incentive give an indicated value of $225,205.63.

## Develop

```bash
npm ci
npm run dev      # local server
npm test         # Vitest, 27 tests
npm run lint     # ESLint
npm run build    # strict tsc + Vite build into dist/
```

TypeScript strict mode, ESLint (typescript-eslint strict) and the tests run in CI on every push.

## Limitations

- Placeholder unit costs only. Real work needs a licensed cost service or your own local cost data, which you can type into the table.
- One building, one improvement type. No multiple buildings, site improvements, or per-component (segregated) cost lines.
- Age-life is the only physical method. No breakdown or observed-condition method.
- Land comps use a plain median with no adjustments for date, location or size.
- The entrepreneurial incentive treatment (a percent of cost new plus land) is one common convention, not the only one. Market-extracted incentive is not calculated.
- Nothing is saved; reload clears your entries.
- No USPAP reconciliation with the sales comparison or income approaches.

## License

MIT, Chase Builds.
