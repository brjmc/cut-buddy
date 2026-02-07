(() => {
  const Engine = window.CutBuddyEngine;
  const runButton = document.getElementById("runBenchmark");
  const copyButton = document.getElementById("copyCsv");
  const downloadButton = document.getElementById("downloadCsv");
  const iterationsInput = document.getElementById("iterationsInput");
  const budgetInput = document.getElementById("budgetInput");
  const statusEl = document.getElementById("benchStatus");
  const logEl = document.getElementById("benchLog");
  const csvEl = document.getElementById("benchCsv");

  if (
    !Engine ||
    !runButton ||
    !copyButton ||
    !downloadButton ||
    !iterationsInput ||
    !budgetInput ||
    !statusEl ||
    !logEl ||
    !csvEl
  ) {
    return;
  }

  const EPSILON = 1e-6;
  const CASE_SIZES = [8, 12, 16, 20, 40, 60, 100];
  const STOCK_LENGTHS = [96, 120, 144];
  const KERF = 0.125;

  let latestCsv = "";
  let isRunning = false;

  const setStatus = (text, isError = false) => {
    statusEl.textContent = text;
    statusEl.style.color = isError ? "#a11919" : "#0b3a1f";
  };

  const setLog = (text) => {
    logEl.textContent = text;
  };

  const setCsv = (text) => {
    latestCsv = text;
    csvEl.textContent = text;
  };

  const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  };

  const percentile = (values, p) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index];
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

  const summarizeRow = ({
    caseName,
    solverName,
    totalTimings,
    kernelTimings,
    completed,
    timedOut,
    wasmCount,
    jsCount
  }) => {
    return [
      caseName,
      solverName,
      round(percentile(totalTimings, 50)).toFixed(2),
      round(percentile(totalTimings, 95)).toFixed(2),
      round(Math.min(...totalTimings)).toFixed(2),
      round(Math.max(...totalTimings)).toFixed(2),
      round(percentile(kernelTimings, 50)).toFixed(2),
      round(percentile(kernelTimings, 95)).toFixed(2),
      round(Math.min(...kernelTimings)).toFixed(2),
      round(Math.max(...kernelTimings)).toFixed(2),
      completed,
      timedOut,
      wasmCount,
      jsCount
    ].join(",");
  };

  const solveExactViaWorker = (worker, payload) => {
    const requestId = Date.now() + Math.floor(Math.random() * 10000);
    const startedAt = performance.now();

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for worker response."));
      }, payload.timeBudgetMs + 4000);

      const onMessage = (event) => {
        const message = event.data || {};
        if (message.type !== "solveResult" || message.requestId !== requestId) return;
        cleanup();
        resolve({
          ok: Boolean(message.ok),
          error: message.error || "",
          result: message.result || {},
          totalElapsedMs: performance.now() - startedAt
        });
      };

      const onError = (event) => {
        cleanup();
        reject(new Error(event.message || "Worker error."));
      };

      const cleanup = () => {
        window.clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
      };

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage({
        ...payload,
        type: "solve",
        requestId
      });
    });
  };

  const runBenchmark = async () => {
    if (isRunning) return;
    isRunning = true;
    runButton.disabled = true;
    setStatus("Benchmark running...");
    setLog("Preparing test cases...");

    let worker = null;
    try {
      if (!("Worker" in window)) {
        throw new Error("Web Worker is not available in this browser.");
      }
      if (window.location.protocol === "file:") {
        throw new Error(
          "This page was opened via file://, which blocks workers. Start a local server and open http://localhost:8080/mobile-benchmark.html."
        );
      }

      const iterations = Math.max(1, Math.min(50, Number.parseInt(iterationsInput.value, 10) || 8));
      const budget = Math.max(1, Math.min(900000, Number.parseInt(budgetInput.value, 10) || 1200));
      iterationsInput.value = String(iterations);
      budgetInput.value = String(budget);
      setStatus(`Benchmark running (budget=${budget}ms, iterations=${iterations})...`);

      worker = new Worker(new URL("exact-solver-worker.js", new URL("scripts/", window.location.href)));

      const rng = createSeededRandom(20260207);
      const cases = CASE_SIZES.map((size) => ({ name: `cuts-${size}`, cuts: randomCase(size, rng) }));
      const lines = [
        "case,solver,total_p50_ms,total_p95_ms,total_min_ms,total_max_ms,kernel_p50_ms,kernel_p95_ms,kernel_min_ms,kernel_max_ms,completed,timeout,backend_wasm,backend_js"
      ];

      for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
        const testCase = cases[caseIndex];
        setLog(`Running ${testCase.name} (${caseIndex + 1}/${cases.length})...`);

        const heuristicTotalTimings = [];
        const heuristicKernelTimings = [];
        const exactTotalTimings = [];
        const exactKernelTimings = [];
        let exactCompleted = 0;
        let exactTimedOut = 0;
        let backendWasm = 0;
        let backendJs = 0;

        for (let runIndex = 0; runIndex < iterations; runIndex += 1) {
          const heuristicStart = performance.now();
          const heuristicResult = Engine.evaluatePacking(testCase.cuts, STOCK_LENGTHS, KERF);
          const heuristicElapsed = performance.now() - heuristicStart;
          heuristicTotalTimings.push(heuristicElapsed);
          heuristicKernelTimings.push(heuristicElapsed);

          const exactPayload = {
            cuts: testCase.cuts,
            stockLengths: STOCK_LENGTHS,
            kerf: KERF,
            timeBudgetMs: budget
          };

          const exact = await solveExactViaWorker(worker, exactPayload);
          if (!exact.ok) {
            throw new Error(exact.error || "Exact worker run failed.");
          }

          const exactResult = exact.result || {};
          const backend = exactResult.solverBackend === "wasm" ? "wasm" : "js";
          if (backend === "wasm") backendWasm += 1;
          if (backend === "js") backendJs += 1;

          exactTotalTimings.push(exact.totalElapsedMs);
          exactKernelTimings.push(Number(exactResult.elapsedMs) || exact.totalElapsedMs);

          if (exactResult.termination === "completed") {
            exactCompleted += 1;
            const heuristicObjective = objective(heuristicResult, KERF);
            const exactObjective = objective(exactResult, KERF);
            if (exactObjective > heuristicObjective + EPSILON) {
              throw new Error(`${testCase.name}: exact objective regressed against heuristic.`);
            }
          } else if (exactResult.termination === "timed_out") {
            exactTimedOut += 1;
          }
        }

        lines.push(
          summarizeRow({
            caseName: testCase.name,
            solverName: "heuristic",
            totalTimings: heuristicTotalTimings,
            kernelTimings: heuristicKernelTimings,
            completed: `-/` + iterations,
            timedOut: `-/` + iterations,
            wasmCount: "-",
            jsCount: "-"
          })
        );
        lines.push(
          summarizeRow({
            caseName: testCase.name,
            solverName: "exact_worker",
            totalTimings: exactTotalTimings,
            kernelTimings: exactKernelTimings,
            completed: `${exactCompleted}/${iterations}`,
            timedOut: `${exactTimedOut}/${iterations}`,
            wasmCount: `${backendWasm}/${iterations}`,
            jsCount: `${backendJs}/${iterations}`
          })
        );
      }

      const csv = lines.join("\n");
      setCsv(csv);
      setLog("Benchmark finished successfully.");
      setStatus("Benchmark complete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown benchmark failure.";
      setStatus("Benchmark failed.", true);
      setLog(message);
    } finally {
      if (worker) worker.terminate();
      runButton.disabled = false;
      isRunning = false;
    }
  };

  copyButton.addEventListener("click", async () => {
    if (!latestCsv) {
      setStatus("No CSV available to copy yet.", true);
      return;
    }
    try {
      await navigator.clipboard.writeText(latestCsv);
      setStatus("CSV copied to clipboard.");
    } catch (_error) {
      setStatus("Copy failed. Select and copy from the CSV box manually.", true);
    }
  });

  downloadButton.addEventListener("click", () => {
    if (!latestCsv) {
      setStatus("No CSV available to download yet.", true);
      return;
    }
    const blob = new Blob([latestCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().replace(/:/g, "-");
    anchor.href = url;
    anchor.download = `cut-buddy-mobile-benchmark-${stamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus("CSV download started.");
  });

  runButton.addEventListener("click", () => {
    runBenchmark();
  });
})();
