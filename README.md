# Cut Buddy

Cut Buddy is a static web app for voice-driven cut-list capture and 1D stock optimization.

## Current App State (February 7, 2026)
- Two primary experiences:
  - Record experience for fast voice capture with confidence feedback.
  - Plan experience for unit selection, stock configuration, and optimization results.
- Client-side speech recognition and text-to-speech confirmation.
- Fraction-capable measurement parsing (with known edge-case backlog in `plan.md`).
- Hybrid solver modes (`heuristic`, `exact`, `auto`) with Best Fit Decreasing preview and background exact branch-and-bound in a Web Worker.
- Exact guardrails: `maxCutsForExact=50`, `exactTimeBudgetMs=3000`, with automatic heuristic fallback messaging.
- Local persistence via `localStorage`.
- PWA shell (`manifest.webmanifest`, `sw.js`).

## Project Files
- `index.html` - app structure and UI regions.
- `styles/main.css` - responsive styling for Record and Plan views.
- `scripts/app.js` - speech capture, parsing, state, unit formatting, and optimization.
- `scripts/exact-solver-worker.js` - worker-side exact solve execution and cancellation.
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

Run JS vs WASM timing benchmark suite:

```bash
node /Users/brendan/dev/cut-buddy/scripts/benchmark-exact-solvers.js --iterations=6 --budget=3000
```

Benchmark output includes both:
- `total_*` timings for end-to-end cost (marshaling + solve).
- `kernel_*` timings for solver-core time (`elapsedMs` returned by solver).
