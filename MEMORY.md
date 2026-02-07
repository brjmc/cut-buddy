# Cut Buddy Memory Log

## Session Summary - 2026-02-07

### Major Deliverables
- Hardened measurement parsing with safe-fail behavior for unsupported denominator-word fraction phrases.
- Extracted shared parser/optimizer core into `scripts/engine.js`.
- Added regression coverage via `scripts/regression-tests.js`.
- Added workflow wiring precheck via `scripts/workflow-precheck.js`.
- Added mobile validation tracking doc: `MOBILE_VALIDATION_REPORT.md`.
- Implemented replacement manual correction interaction in record mode:
  - parse failure opens correction panel,
  - corrected phrase can be applied inline without leaving recording flow.
- Completed UI Sketch implementation plan steps 1-7 in `plan.md`:
  - plan DOM restructured to top config/cuts + lower results section,
  - controls simplified and de-emphasized for sketch parity,
  - recording view reprioritized around latest accepted cut + grouped counts,
  - record exit now auto-scrolls to results with reduced-motion fallback,
  - responsive spacing/tap targets tuned,
  - focus behavior added for record enter/exit.
- Manual validation was completed by user and reflected as complete in plan tracking.
- Added exact optimization stack:
  - hybrid solver modes (`heuristic`, `exact`, `auto`) with guardrails,
  - exact branch-and-bound solver in `scripts/engine.js`,
  - Rust WASM solver crate at `native/cut_buddy_exact_wasm`,
  - worker integration with WASM primary backend and JS fallback.
- Added validation tooling for exact path:
  - browser smoke page `wasm-smoke.html` requiring worker backend `wasm`,
  - benchmark suite `scripts/benchmark-exact-solvers.js` with `total_*` and `kernel_*` timing splits.

### Current Product Reality
- Parser now rejects unsupported formats (for example denominator-word variants like `13/64ths`) instead of producing bogus values.
- Parse failures provide explicit feedback and preserve stable latest accepted cut display.
- Record view is immersive and prioritizes capture-centric information hierarchy.
- Exiting recording returns to plan and jumps user to results context.
- Core parser/optimizer behavior is testable outside the browser.
- Exact solver behavior now has deterministic fixtures in both JS and Rust test paths.

### Source of Truth Files
- Plan/status: `plan.md`
- Validation status and checklist: `MOBILE_VALIDATION_REPORT.md`
- Parser/optimizer core: `scripts/engine.js`
- Regression tests: `scripts/regression-tests.js`
- Workflow guard checks: `scripts/workflow-precheck.js`

### Follow-up Opportunities
1. Add a compact `jump to config` affordance when deep in results (already noted in `plan.md`).
2. Expand parser regression set with more speech-transcript edge cases from field usage.
