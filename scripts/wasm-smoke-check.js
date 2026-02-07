(() => {
  const statusEl = document.getElementById("smokeStatus");
  const detailEl = document.getElementById("smokeDetail");
  const runButton = document.getElementById("runSmoke");

  const setStatus = (text, isError = false) => {
    statusEl.textContent = text;
    statusEl.style.color = isError ? "#a11919" : "#0b3a1f";
  };

  const setDetail = (text) => {
    detailEl.textContent = text;
  };

  const runSmokeCheck = async () => {
    setStatus("Running WASM smoke check...");
    setDetail("Starting worker...");
    runButton.disabled = true;

    let worker = null;

    try {
      if (window.location.protocol === "file:") {
        throw new Error(
          "This page was opened via file://, which blocks Web Workers. Start a local server and open http://localhost:8080/wasm-smoke.html."
        );
      }

      worker = new Worker(new URL("scripts/exact-solver-worker.js", window.location.href));
      const requestId = Date.now();

      const payload = {
        type: "solve",
        requestId,
        cuts: [52, 48, 48, 45, 36, 24, 24],
        stockLengths: [96, 120],
        kerf: 0.125,
        timeBudgetMs: 3000
      };

      const result = await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error("Timed out waiting for worker response."));
        }, 10000);

        worker.onmessage = (event) => {
          const message = event.data || {};
          if (message.type !== "solveResult" || message.requestId !== requestId) return;
          window.clearTimeout(timeout);
          resolve(message);
        };

        worker.onerror = (event) => {
          window.clearTimeout(timeout);
          reject(new Error(event.message || "Worker error."));
        };

        worker.postMessage(payload);
      });

      if (!result.ok) {
        throw new Error(result.error || "Worker returned failure.");
      }

      const solveResult = result.result || {};
      if (solveResult.solverBackend !== "wasm") {
        throw new Error(`Expected solverBackend=wasm, got ${solveResult.solverBackend || "unknown"}.`);
      }
      if (solveResult.termination !== "completed") {
        throw new Error(`Expected termination=completed, got ${solveResult.termination || "unknown"}.`);
      }
      if (solveResult.optimality !== "proven_optimal") {
        throw new Error(`Expected optimality=proven_optimal, got ${solveResult.optimality || "unknown"}.`);
      }

      setStatus("PASS: worker solved with WASM backend.");
      setDetail(
        `elapsed=${solveResult.elapsedMs}ms nodes=${solveResult.exploredNodes} bins=${solveResult.binCount} waste=${solveResult.totalWaste}`
      );
    } catch (error) {
      setStatus("FAIL: WASM smoke check failed.", true);
      setDetail(error instanceof Error ? error.message : "Unknown failure.");
    } finally {
      if (worker) {
        worker.terminate();
      }
      runButton.disabled = false;
    }
  };

  runButton.addEventListener("click", () => {
    runSmokeCheck();
  });
})();
