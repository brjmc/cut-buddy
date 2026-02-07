# Exact Solver Rollout Report

Date: February 7, 2026

## Desktop Distribution Capture
Command used:

```bash
node /Users/brendan/dev/cut-buddy/scripts/benchmark-exact-solvers.js --iterations=8 --budget=1200
```

Output:

```text
case,solver,total_p50_ms,total_p95_ms,total_min_ms,total_max_ms,kernel_p50_ms,kernel_p95_ms,kernel_min_ms,kernel_max_ms,completed,timeout
cuts-20,heuristic,0.03,0.18,0.03,0.18,0.03,0.18,0.03,0.18,-/8,-/8
cuts-20,js,1200.08,1200.18,1200.04,1200.18,1200.07,1200.12,1200.03,1200.12,0/8,8/8
cuts-20,wasm,1218.19,1219.99,1217.40,1219.99,1200.01,1200.01,1200.01,1200.01,0/8,8/8
cuts-40,heuristic,0.04,0.05,0.02,0.05,0.04,0.05,0.02,0.05,-/8,-/8
cuts-40,js,1200.17,1201.57,1200.07,1201.57,1200.16,1201.56,1200.06,1201.56,0/8,8/8
cuts-40,wasm,1205.93,1206.86,1205.65,1206.86,1200.03,1200.03,1200.02,1200.03,0/8,8/8
cuts-60,heuristic,0.06,0.07,0.04,0.07,0.06,0.07,0.04,0.07,-/8,-/8
cuts-60,js,1200.27,1200.55,1200.09,1200.55,1200.26,1200.54,1200.07,1200.54,0/8,8/8
cuts-60,wasm,1204.49,1205.29,1204.35,1205.29,1200.07,1200.09,1200.07,1200.09,0/8,8/8
cuts-100,heuristic,0.12,0.14,0.07,0.14,0.12,0.14,0.07,0.14,-/8,-/8
cuts-100,js,1200.44,1200.98,1200.21,1200.98,1200.42,1200.96,1200.19,1200.96,0/8,8/8
cuts-100,wasm,1202.20,1202.55,1202.08,1202.55,1200.13,1200.14,1200.12,1200.14,0/8,8/8
```

## Supplemental Cut-Count Probe
Single-run probe command:

```bash
node -e 'const {evaluatePackingExact}=require("./scripts/engine.js"); const mk=(n,s)=>{let x=s>>>0;const r=()=>{x=(1664525*x+1013904223)>>>0;return x/0x100000000};return Array.from({length:n},()=>12+Math.round(r()*84));}; const stocks=[96,120,144], kerf=0.125; for (const n of [8,12,16,20]) { const cuts=mk(n,20260207+n); const r1200=evaluatePackingExact(cuts,stocks,kerf,{timeBudgetMs:1200}); const r3000=evaluatePackingExact(cuts,stocks,kerf,{timeBudgetMs:3000}); console.log(`${n},1200:${r1200.termination}/${r1200.elapsedMs.toFixed(2)},3000:${r3000.termination}/${r3000.elapsedMs.toFixed(2)}`); }'
```

Observed:

```text
8,1200:completed/1.97,3000:completed/1.09
12,1200:completed/36.51,3000:completed/34.11
16,1200:completed/780.50,3000:completed/749.92
20,1200:timed_out/1200.18,3000:timed_out/3000.04
```

## Guardrail Tuning
Based on the measured desktop timings:
- Set `maxCutsForExact` to `16`.
- Set `exactTimeBudgetMs` to `1200`.

Reasoning:
- p95 heuristic latency remains sub-millisecond.
- 20+ representative cases time out consistently for exact at both 1200ms and 3000ms.
- 16-cut supplemental case can complete within 1200ms, while 20-cut case consistently times out.

## Release Gate (removed)
Feature-flagged rollout has been removed per February 2026 direction; exact mode now obeys `exactTimeBudgetMs` and `maxCutsForExact` without a gating switch.

## Mobile Validation Pending
Run these on:
- iOS Safari
- Mobile Chrome

Workflow:
1. Open `http://localhost:8080/mobile-benchmark.html`.
2. Keep defaults (`iterations=8`, `budget=1200`) unless you need a follow-up run.
3. Tap `Run benchmark`, then `Copy CSV` or `Download CSV`.
4. Append CSV output to this report with device + browser + date metadata.
5. Update `plan.md` Phase 4 item 2 when both browsers are recorded.

## User-Submitted Mobile CSV (Unlabeled Browser/Device)
Submitted after initial mobile harness rollout:

```text
case,solver,total_p50_ms,total_p95_ms,total_min_ms,total_max_ms,kernel_p50_ms,kernel_p95_ms,kernel_min_ms,kernel_max_ms,completed,timeout,backend_wasm,backend_js
cuts-20,heuristic,0.00,0.10,0.00,0.10,0.00,0.10,0.00,0.10,-/8,-/8,-,-
cuts-20,exact_worker,10129.20,10142.50,10128.20,10142.50,10000.10,10000.10,10000.10,10000.10,0/8,8/8,8/8,0/8
cuts-40,heuristic,0.00,0.10,0.00,0.10,0.00,0.10,0.00,0.10,-/8,-/8,-,-
cuts-40,exact_worker,10042.10,10044.30,10041.60,10044.30,10000.10,10000.20,10000.10,10000.20,0/8,8/8,8/8,0/8
cuts-60,heuristic,0.00,0.10,0.00,0.10,0.00,0.10,0.00,0.10,-/8,-/8,-,-
cuts-60,exact_worker,10033.10,10035.80,10032.50,10035.80,10000.20,10000.30,10000.20,10000.30,0/8,8/8,8/8,0/8
cuts-100,heuristic,0.00,0.10,0.00,0.10,0.00,0.10,0.00,0.10,-/8,-/8,-,-
cuts-100,exact_worker,10013.30,10014.30,10012.70,10014.30,10000.30,10000.40,10000.30,10000.40,0/8,8/8,8/8,0/8
```

Interpretation:
- `backend_wasm=8/8` confirms worker is using WASM backend correctly.
- `kernel_* ~= 10000ms` indicates the run used a 10,000ms exact budget and hit timeout bound, not a worker/setup failure.
- For these stress cases (20/40/60/100 random cuts), timeout is expected under bounded exact search.
