# Benchmark

Run it yourself: `npm run bench` (Node 22, `bench/bench.ts`). The script sweeps 25,920 synthetic cases (gross living area 800 to 3,990 sq ft in steps of 10, effective age 0 to 80 years) through the full cost-approach estimate, checks three invariants on every case, then times 129,600 estimates (the sweep five times).

Invariants checked on each case:

- indicated value = land + replacement cost new - total depreciation + incentive
- depreciated improvements are never negative
- total depreciation never exceeds replacement cost new

## Result (this machine, one run)

| Measure | Value |
|---|---|
| Cases swept | 25,920 |
| Invariant violations | 0 |
| Estimates timed | 129,600 |
| Total time | 43.8 ms |
| Estimates per second | 2,958,620 |

Speed varies by machine and run. The point is that recalculating on every keystroke costs nothing noticeable.

## Test suite

`npm test`: 39 Vitest tests across 2 files, all passing. Worked examples are hand-checked in the comments.
