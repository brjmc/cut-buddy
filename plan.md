# Cut Buddy Plan

## Current State (February 7, 2026)
Implemented and active in the app:
- Voice capture with continuous speech recognition.
- Confidence feedback with live color/state updates.
- Spoken measurement parsing with mixed-fraction formatting in UI.
- Cut list management via grouped length rows (manual add, row selection, inline increment/decrement/remove).
- Unit-aware display and parsing defaults (inches, feet, cm, mm).
- Stock configuration + kerf input.
- Client-side Best Fit Decreasing optimization.
- Results with stock count, waste, utilization, kerf impact, and per-stock cut patterns.
- Local persistence and PWA shell support.
- Record flow now enters from explicit `Record cuts` action and exits on `Stop recording`.
- Record view now runs as an immersive full-screen capture surface with app chrome hidden.
- Header mode toggle controls removed from user-visible UI.
- Manual correction modal removed; correction/editing now happens through Cut List row controls.
- Metric unit selection now applies metric-aware default stock presets.
- Cut List status icons now indicate plan coverage (`✓`, `!`, `•`) and refresh as solver results update.

## Open Workstreams
1. Input Reliability and Parsing
- Harden fraction parsing for denominator-word phrases and unsupported formats.
- Improve error messaging for parse failures to avoid silent/bogus numeric outputs.

2. Planning and Presets
- Continue refining stock setup ergonomics for fast editing.
- Confirm preset behavior with existing saved/local states across unit switches.

3. Quality and Validation
- Add parser/optimizer regression tests for core measurement cases.
- Run cross-device validation (iOS Safari priority).

## Immediate Next Implementation Batch
1. [x] Harden parser handling for denominator-word and unsupported fraction phrases (safe-fail behavior).
2. [x] Add parser/optimizer regression tests for high-risk measurement inputs.
3. [x] Validate full recording/plan workflow on iOS Safari and mobile Chrome. (manual validation complete; see `MOBILE_VALIDATION_REPORT.md`)
4. [x] Design and implement a replacement manual correction interaction pattern.

## UI Sketch Implementation Plan (February 7, 2026)
Target: align app flow to attached sketch with:
- A compact config/plan card at top.
- A dedicated recording view while capturing.
- Results section positioned below the fold in plan mode.
- Automatic scroll to results area when returning from record to plan.

### Existing UI Analysis
- Current app has two separate mode containers:
  - `#recordView` (full-screen, hides hero and plan with `body.record-mode-active`).
  - `#planView` (single-page plan controls + input + stock + results grid).
- Plan controls are currently split across multiple cards and include confidence tools not shown in sketch.
- Record view currently prioritizes confidence label/score and grouped summary, while sketch prioritizes:
  - unit at top,
  - most recent accepted cut large in center,
  - grouped repeated cuts beneath,
  - single stop-recording action.
- Returning from record mode currently just toggles view; no targeted scroll behavior exists.

### Implementation Plan
1. [x] Restructure Plan DOM to match sketch hierarchy
- Introduce a top “Config/Plan” card containing:
  - title,
  - unit selector,
  - stock lengths input + pill preview,
  - kerf input,
  - primary `Record` CTA.
- Move optimization output into a lower “Results” section that naturally sits below fold on mobile.
- Keep `Calculate plan` anchored near results section per sketch.

2. [x] Simplify controls for sketch parity
- Remove/de-emphasize confidence slider/pills from plan surface (keep internals if needed, hide from primary UX).
- Preserve existing edit/undo/clear operations, but move secondary actions out of primary visual path.
- Rename CTA labels to sketch language:
  - `Record cuts` -> `record`
  - `Stop recording` stays primary in record mode.

3. [x] Adjust recording view content and visual priority
- Keep immersive recording screen behavior.
- Reorder record content blocks:
  - unit label top,
  - latest accepted measurement dominant center text,
  - grouped counts beneath latest value,
  - bottom sticky `stop recording` button.
- Ensure parse failures show explicit “could not parse” feedback without replacing stable grouped summary.

4. [x] Implement “return + auto-scroll to results” flow
- Add a stable anchor id for results section (example: `#resultsSection`).
- On transition `record -> plan`:
  - complete mode switch,
  - `requestAnimationFrame`/micro-delay,
  - call `scrollIntoView({ behavior: "smooth", block: "start" })` on results section.
- Gate auto-scroll to only run on exits from recording (not all mode changes).

5. [x] Responsive behavior and spacing
- Mobile-first stack should mirror sketch:
  - config card first,
  - results section below.
- Desktop keeps readable widths but preserves vertical workflow order.
- Verify button sizing and spacing for field use tap targets.

6. [x] Accessibility and interaction checks
- Keep clear ARIA labels for recording region and result area.
- Ensure focus moves predictably after mode switch:
  - on enter record: focus stop/start button,
  - on exit record: focus results heading (after scroll) for screen-reader continuity.
- Respect reduced-motion preference for smooth scroll fallback.

7. [x] Validation checklist (manual validation complete)
- Start in plan mode, tap `record`, confirm immersive record view.
- Accept several spoken cuts, verify central latest value + grouped list updates.
- Tap `stop recording`, verify:
  - plan mode restored,
  - viewport scrolls to results area,
  - existing cuts preserved.
- Run `calculate plan`, confirm results render and remain reachable via normal scroll.

## Future Change List
- After sketch parity, add a compact “jump to config” affordance when user is deep in results.

## Exact Optimization (WASM) Plan (February 7, 2026)
Goal: add an optional exact solver path that can prove optimality for small/medium jobs while preserving current fast UX.

### Constraints and Product Rules
- Keep current Best Fit Decreasing heuristic as default fast path.
- Exact mode must be bounded by both input-size threshold and runtime budget.
- Never block the UI thread; exact solver runs in a Web Worker.
- If exact mode times out/fails, fall back to heuristic and surface clear status.

### Phase 1 - Hybrid Scaffolding (No WASM Yet)
1. [x] Add solver mode state and strategy selection (`heuristic`, `exact`, `auto`).
2. [x] Add guardrails:
- `maxCutsForExact` (initial: 50 cuts).
- `exactTimeBudgetMs` (initial: 3000 ms).
3. [x] Add result metadata:
- `solverUsed` (`heuristic` | `exact` | `heuristic_fallback`),
- `optimality` (`proven_optimal` | `not_proven` | `timed_out`).
4. [x] Add UI copy for solver status and fallback reason.

### Phase 2 - Exact Solver in Rust + WASM
1. [x] Create Rust crate for exact 1D cutting-stock/bin-packing search.
2. [x] Implement branch-and-bound with:
- upper bound seeded by current heuristic,
- lower bound from total-length/stock-capacity relaxation,
- pruning on symmetric states and dominated bins.
3. [x] Compile to `wasm32-unknown-unknown` and expose a compact API:
- input: cuts, stock lengths, kerf, time budget,
- output: bins, objective stats, status/termination reason.
4. [x] Add deterministic fixtures to verify exact output parity and proof flags.

### Phase 3 - Browser Integration
1. [x] Add worker wrapper for WASM module loading/execution. (WASM primary path active with JS fallback)
2. [x] Wire `auto` mode:
- run heuristic immediately for instant preview,
- run exact in background only when within threshold,
- replace results only if exact finishes within budget.
3. [x] Preserve cancellation semantics:
- cancel in-flight exact solve on any input change.

### Phase 4 - Validation (POC)
1. [x] Add benchmark script with representative cases (20/40/60/100 cuts).
2. [ ] Record solve-time distributions for heuristic vs exact (desktop + mobile Chrome/Safari). (desktop captured on February 7, 2026; mobile harness added at `mobile-benchmark.html`; mobile Safari/Chrome runs still pending)
3. [x] Tune thresholds/time budget from measured p95 latencies. (current app guardrails: `maxCutsForExact=16`, `exactTimeBudgetMs=20000`)
4. [ ] Validate in-app runtime behavior:
- no UI jank in record/plan workflow,
- exact status messaging is clear,
- fallback behavior is reliable.

### Acceptance Criteria
- User can see when output is proven optimal vs heuristic.
- No UI freeze during exact runs.
- For small/medium jobs, exact mode can frequently complete within budget.
- Large/hard jobs degrade gracefully to heuristic with explicit explanation.

## Anytime Approximate Improvement Worker Plan (February 7, 2026)
Goal: add a background approximate solver that incrementally improves heuristic results for jobs where exact search is slow or times out.

### Helpful Context
- There is no true sub-polynomial algorithm for this problem class in the general case; we must at least read all cuts (`Omega(n)` input scan).
- Current runtime behavior:
  - heuristic solution returns immediately on main thread,
  - exact branch-and-bound runs in worker with guardrails (`maxCutsForExact=16`, `exactTimeBudgetMs=20000` in current app code),
  - exact can still time out or fail on hard instances.
- Objective should remain aligned with existing solver comparison logic:
  - primary: `totalStockLength + kerf * binCount`,
  - tie-breakers: lower waste, then fewer bins.

### Product Rules for Approximate Worker
- Never block UI thread; all improvement search runs in dedicated worker.
- Preserve cancellation semantics on any input/config change.
- Only surface a candidate if it is strictly better than current incumbent objective.
- Keep deterministic mode available for reproducible tests (seeded RNG).
- Bound runtime and memory so worker cannot degrade app stability.

### POC Implementation Checklist
1. [x] Add `scripts/approx-improver-worker.js` and message protocol:
- message types: `start`, `cancel`, `progress`, `improvement`, `done`, `error`,
- payloads include cuts, stock lengths, kerf, time budget, seed, and request id,
- app-side request-id fencing ignores stale results.
2. [x] Implement baseline anytime improver:
- multi-start heuristic search with randomized tie-breaks and cut-order perturbations,
- strict wall-time budget,
- progress heartbeat plus incumbent-only improvement messages.
3. [x] Add local-search operators:
- relocate single cut between bins,
- swap cuts between bins,
- optional small ejection-chain attempt,
- accept only feasible moves that improve objective.
4. [x] Add bounded LNS pass:
- destroy/repair cycle over selected bins,
- repair with BFD/FFD variant,
- hard caps on iteration count and frontier/state size.
5. [x] Integrate into app runtime:
- add `approx` path in solver metadata (`solverUsed`, `optimality`, `solverStatus`),
- in `auto`, show heuristic immediately and run improver in worker,
- replace displayed result only on strict objective improvement,
- preserve cancellation behavior on every input/config change.
6. [ ] Add POC validation tooling: (benchmark + regression automation complete; manual mobile Safari/Chrome validation still pending)
- benchmark script reporting improvement frequency, mean/p95 objective lift, and timeout rate,
- regression coverage for monotonic updates, cancellation correctness, and seeded reproducibility,
- manual check on desktop + mobile Safari/Chrome for no visible UI jank.

### Acceptance Criteria (Approximate Worker)
- For jobs above exact threshold, app can still improve beyond initial heuristic in background without UI jank.
- Improved candidates are feasible and never worse than displayed incumbent.
- Cancellation on input change is reliable and prevents stale overwrite.
- Status messaging distinguishes heuristic, approximate, and exact outcomes clearly.
