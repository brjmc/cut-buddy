# Cut Buddy

Cut Buddy is a static web app for voice-driven cut-list capture and 1D stock optimization.

## Current App State (February 7, 2026)
- Two primary experiences:
  - Record experience for fast voice capture with grouped recency summary.
  - Plan experience for unit selection, stock configuration, cut-list management, and optimization results.
- Client-side speech recognition and text-to-speech confirmation.
- Fraction-capable measurement parsing (with known edge-case backlog in `plan.md`).
- Hybrid solver modes (`heuristic`, `exact`, `auto`) with Best Fit Decreasing preview, background exact branch-and-bound, and background anytime approximate improvement in Web Workers.
- Exact guardrails: `maxCutsForExact=16`, `exactTimeBudgetMs=20000`, with automatic heuristic fallback messaging.
- Cut List UI groups entries by length, supports manual add (`43 1/2` style input), row selection, and inline `+`, `-`, `🗑` controls.
- Cut List rows show plan-coverage status:
  - `✓` fully covered by current plan,
  - `!` not fully covered by current plan,
  - `•` plan not yet calculated.
- Local persistence via `localStorage`.
- PWA shell (`manifest.webmanifest`, `sw.js`).

## Project Files
- `index.html` - app structure and UI regions.
- `styles/main.css` - responsive styling for Record and Plan views.
- `scripts/app.js` - speech capture, parsing, state, unit formatting, and optimization.
- `scripts/exact-solver-worker.js` - worker-side exact solve execution and cancellation.
- `scripts/approx-improver-worker.js` - worker-side anytime approximate improver (`start/cancel/progress/improvement/done/error` protocol).
- `native/cut_buddy_exact_wasm` - Rust crate for exact branch-and-bound solver.
- `scripts/build-exact-wasm.sh` - builds `scripts/wasm/cut_buddy_exact_wasm.wasm`.
- `SPEC.md` - product requirements and success criteria.
- `plan.md` - execution plan and future change list.
- `UI_DESIGN.md` - UI architecture and interaction principles.

## Run Locally
```bash
cd /Users/brendan/dev/cut-buddy
python3 -m http.server 8080
```
Open `http://localhost:8080`.

## WASM Build + Validation
Build the exact solver WASM artifact:

```bash
/Users/brendan/dev/cut-buddy/scripts/build-exact-wasm.sh
```

Run browser smoke check page (expects worker backend = `wasm`):

```bash
# while local server is running (must use http://, not file://)
open http://localhost:8080/wasm-smoke.html
```

Run mobile/browser benchmark page (heuristic vs exact-worker CSV):

```bash
open http://localhost:8080/mobile-benchmark.html
```

Run JS vs WASM timing benchmark suite:

```bash
node /Users/brendan/dev/cut-buddy/scripts/benchmark-exact-solvers.js --iterations=8 --budget=1200
```

Benchmark output includes:
- `heuristic` rows for fast-path baseline.
- `js` and `wasm` rows for exact solver paths.
- `total_*` timings for end-to-end cost (marshaling + solve).
- `kernel_*` timings for solver-core time (`elapsedMs` returned by solver).

Compare solution quality gap (heuristic vs exact) with the new script:

```bash
node /Users/brendan/dev/cut-buddy/scripts/compare-heuristic-vs-exact.js --samples=200 --sizes=8,10,12 --budget=1200
```

Output columns:
- `improved_rate`: ratio of exact runs that improved on heuristic objective.
- `avg_obj_improvement_pct`: average objective gain on improved cases.
- `exact_timed_out`: how often exact timed out within the budget.

Benchmark the anytime approximate improver:

```bash
node /Users/brendan/dev/cut-buddy/scripts/benchmark-approx-improver.js --samples=120 --sizes=20,40,60,100 --budget=2500
```

Output columns:
- `improved_rate`: how often approximate improved the initial heuristic result.
- `mean_obj_lift` / `p95_obj_lift`: objective improvement distribution on improved runs.
- `timeout_rate`: share of runs hitting the configured budget before completion.


## Feature Flag (Exact Solver)
Exact is release-gated and defaults to OFF.
