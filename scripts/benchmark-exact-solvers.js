#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const assert = require("node:assert/strict");

const { evaluatePackingExact } = require("./engine.js");

const WASM_PATH = path.resolve(__dirname, "wasm", "cut_buddy_exact_wasm.wasm");
const EPSILON = 1e-6;

const parseArgs = () => {
  const args = new Map();
  process.argv.slice(2).forEach((entry) => {
    const [key, value] = entry.split("=");
    if (!key.startsWith("--")) return;
    args.set(key.slice(2), value === undefined ? "true" : value);
  });
  return {
    iterations: Math.max(1, Number.parseInt(args.get("iterations") || "6", 10)),
    budget: Math.max(1, Number.parseInt(args.get("budget") || "3000", 10))
  };
};

const createSeededRandom = (seed = 42) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const randomCase = (count, rng) => {
  const cuts = [];
  for (let index = 0; index < count; index += 1) {
    const value = 12 + Math.round(rng() * 84);
    cuts.push(value);
  }
  return cuts;
};

const objective = (result, kerf) => result.totalStockLength + kerf * result.binCount;

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

const loadWasmSolver = async () => {
  const bytes = fs.readFileSync(WASM_PATH);
  const { instance } = await WebAssembly.instantiate(bytes, {
    env: {
      now_ms: () => performance.now()
    }
  });
  const exports = instance.exports;
  const memory = exports.memory;

  assert.ok(memory, "WASM export `memory` missing");
  ["alloc", "dealloc", "solve_json", "output_ptr", "output_len"].forEach((name) => {
    assert.equal(typeof exports[name], "function", `WASM export \`${name}\` missing`);
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return {
    solve(payload) {
      const json = JSON.stringify(payload);
      const inputBytes = encoder.encode(json);
      const ptr = exports.alloc(inputBytes.length);
      new Uint8Array(memory.buffer, ptr, inputBytes.length).set(inputBytes);
      const status = exports.solve_json(ptr, inputBytes.length);
      exports.dealloc(ptr, inputBytes.length);

      const outputPtr = exports.output_ptr();
      const outputLen = exports.output_len();
      const outputText = decoder.decode(new Uint8Array(memory.buffer, outputPtr, outputLen));
      const output = JSON.parse(outputText);
      if (status !== 1) {
        throw new Error(output.error || "WASM solve failed");
      }
      return output;
    }
  };
};

const run = async () => {
  const { iterations, budget } = parseArgs();
  if (!fs.existsSync(WASM_PATH)) {
    throw new Error(`Missing WASM binary at ${WASM_PATH}. Run scripts/build-exact-wasm.sh first.`);
  }

  const wasmSolver = await loadWasmSolver();
  const rng = createSeededRandom(20260207);
  const stockLengths = [96, 120, 144];
  const kerf = 0.125;

  const cases = [
    { name: "cuts-20", cuts: randomCase(20, rng) },
    { name: "cuts-40", cuts: randomCase(40, rng) },
    { name: "cuts-60", cuts: randomCase(60, rng) },
    { name: "cuts-100", cuts: randomCase(100, rng) }
  ];

  console.log(`Benchmarking JS vs WASM exact solver (iterations=${iterations}, budget=${budget}ms)`);
  console.log(
    "case,solver,total_p50_ms,total_p95_ms,total_min_ms,total_max_ms,kernel_p50_ms,kernel_p95_ms,kernel_min_ms,kernel_max_ms,completed,timeout"
  );

  for (const testCase of cases) {
    const jsTotalTimings = [];
    const wasmTotalTimings = [];
    const jsKernelTimings = [];
    const wasmKernelTimings = [];
    let jsCompleted = 0;
    let wasmCompleted = 0;
    let jsTimedOut = 0;
    let wasmTimedOut = 0;

    for (let runIndex = 0; runIndex < iterations; runIndex += 1) {
      const payload = {
        cuts: testCase.cuts,
        stockLengths,
        kerf,
        timeBudgetMs: budget
      };

      const jsStart = performance.now();
      const jsResult = evaluatePackingExact(payload.cuts, payload.stockLengths, payload.kerf, {
        timeBudgetMs: payload.timeBudgetMs
      });
      const jsElapsed = performance.now() - jsStart;
      jsTotalTimings.push(jsElapsed);
      jsKernelTimings.push(Number(jsResult.elapsedMs) || jsElapsed);
      if (jsResult.termination === "completed") jsCompleted += 1;
      if (jsResult.termination === "timed_out") jsTimedOut += 1;

      const wasmStart = performance.now();
      const wasmResult = wasmSolver.solve(payload);
      const wasmElapsed = performance.now() - wasmStart;
      wasmTotalTimings.push(wasmElapsed);
      wasmKernelTimings.push(Number(wasmResult.elapsedMs) || wasmElapsed);
      if (wasmResult.termination === "completed") wasmCompleted += 1;
      if (wasmResult.termination === "timed_out") wasmTimedOut += 1;

      if (jsResult.termination === "completed" && wasmResult.termination === "completed") {
        const jsObjective = objective(jsResult, kerf);
        const wasmObjective = objective(wasmResult, kerf);
        assert.ok(wasmObjective <= jsObjective + EPSILON, "WASM objective regressed against JS on completed run");
      }
    }

    const summarize = (name, totalTimings, kernelTimings, completed, timedOut) => {
      console.log(
        [
          testCase.name,
          name,
          percentile(totalTimings, 50).toFixed(2),
          percentile(totalTimings, 95).toFixed(2),
          Math.min(...totalTimings).toFixed(2),
          Math.max(...totalTimings).toFixed(2),
          percentile(kernelTimings, 50).toFixed(2),
          percentile(kernelTimings, 95).toFixed(2),
          Math.min(...kernelTimings).toFixed(2),
          Math.max(...kernelTimings).toFixed(2),
          `${completed}/${iterations}`,
          `${timedOut}/${iterations}`
        ].join(",")
      );
    };

    summarize("js", jsTotalTimings, jsKernelTimings, jsCompleted, jsTimedOut);
    summarize("wasm", wasmTotalTimings, wasmKernelTimings, wasmCompleted, wasmTimedOut);
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
