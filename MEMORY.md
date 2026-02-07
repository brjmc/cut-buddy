# Cut Buddy Memory Log

## Session Summary - 2026-02-07

### Major Deliverables
- Parser hardened for unsupported denominator-word fractions (safe-fail behavior).
- Shared engine core (`scripts/engine.js`) now powers browser app, workers, and Node tooling.
- Exact optimization path is active with:
  - solver modes (`heuristic`, `exact`, `auto`),
  - exact worker (`scripts/exact-solver-worker.js`) with WASM-first backend and JS fallback,
  - guardrails (`maxCutsForExact=16`, `exactTimeBudgetMs=20000`).
- Added anytime approximate optimization path:
  - worker (`scripts/approx-improver-worker.js`) with `start/cancel/progress/improvement/done/error` protocol,
  - engine support for multi-start randomized search + local search + bounded LNS,
  - strict objective-only replacement semantics and request-id fencing.
- Added/expanded validation tooling:
  - regression tests (`scripts/regression-tests.js`) including approximate monotonicity/cancellation/reproducibility checks,
  - exact benchmark (`scripts/benchmark-exact-solvers.js`),
  - approximate benchmark (`scripts/benchmark-approx-improver.js`),
  - quality comparison (`scripts/compare-heuristic-vs-exact.js`),
  - browser harnesses (`wasm-smoke.html`, `mobile-benchmark.html`).
- Refined record and cut-list UX:
  - record summary list is recency-ordered with grouped counts,
  - manual correction panel removed,
  - manual cut add input added to the plan card,
  - cut list is grouped by length with quantity and plan-coverage status (`✓`, `!`, `•`),
  - cut list rows are selectable and show `+`, `-`, `🗑` controls only when selected.
- Results/cut status synchronization improved:
  - cut coverage icons refresh when calculation starts and when exact/approx updates land.

### Current Product Reality
- Parser rejects unsupported formats (for example `13/64ths`) instead of producing bogus numeric output.
- Record flow is immersive and optimized for rapid voice capture; exiting record auto-scrolls to results.
- Plan-mode `Cut List` is now the primary correction/edit surface (grouped, selectable, incremental controls).
- Solver status distinguishes heuristic preview, approximate improvements, and exact completion/fallback.
- Engine behavior is testable from Node and worker contexts with deterministic seeded runs.

### Source of Truth Files
- Plan/status: `plan.md`
- Validation status and checklist: `MOBILE_VALIDATION_REPORT.md`
- Parser/optimizer core: `scripts/engine.js`
- Regression tests: `scripts/regression-tests.js`
- App runtime orchestration: `scripts/app.js`

### Follow-up Opportunities
1. Complete manual mobile Safari/Chrome runtime validation for exact/approx worker behavior and UI jank checks.
2. Add an explicit status legend in UI for `✓`, `!`, and `•` cut-list indicators.
3. Add parser regression cases from real-world voice transcripts collected during field use.
