/* global CutBuddyEngine */

importScripts("./engine.js");

const Engine = self.CutBuddyEngine;

const cancelledRequests = new Set();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let wasmSolverPromise = null;

const postSolveError = (requestId, message) => {
  self.postMessage({
    type: "solveResult",
    requestId,
    ok: false,
    error: message
  });
};

const loadWasmSolver = async () => {
  if (wasmSolverPromise) return wasmSolverPromise;

  wasmSolverPromise = (async () => {
    const moduleUrl = new URL("./wasm/cut_buddy_exact_wasm.wasm", self.location.href);
    const response = await fetch(moduleUrl);
    if (!response.ok) {
      throw new Error(`WASM fetch failed (${response.status})`);
    }

    const bytes = await response.arrayBuffer();
    const imports = {
      env: {
        now_ms: () => {
          if (typeof performance !== "undefined" && typeof performance.now === "function") {
            return performance.now();
          }
          return Date.now();
        }
      }
    };
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    const exports = instance.exports;
    const memory = exports.memory;
    if (!memory) {
      throw new Error("WASM module missing memory export.");
    }
    if (!exports.alloc || !exports.dealloc || !exports.solve_json || !exports.output_ptr || !exports.output_len) {
      throw new Error("WASM module missing required solver exports.");
    }

    return {
      solve: async ({ cuts, stockLengths, kerf, timeBudgetMs }) => {
        const payload = JSON.stringify({
          cuts,
          stockLengths,
          kerf,
          timeBudgetMs
        });
        const payloadBytes = encoder.encode(payload);
        const ptr = exports.alloc(payloadBytes.length);
        const memoryBytes = new Uint8Array(memory.buffer, ptr, payloadBytes.length);
        memoryBytes.set(payloadBytes);

        const status = exports.solve_json(ptr, payloadBytes.length);
        exports.dealloc(ptr, payloadBytes.length);

        const outputPtr = exports.output_ptr();
        const outputLen = exports.output_len();
        const outputView = new Uint8Array(memory.buffer, outputPtr, outputLen);
        const outputText = decoder.decode(outputView);
        const output = JSON.parse(outputText);

        if (status !== 1) {
          throw new Error((output && output.error) || "WASM exact solver failed.");
        }
        return output;
      }
    };
  })().catch((error) => {
    wasmSolverPromise = null;
    throw error;
  });

  return wasmSolverPromise;
};

const solveWithExact = async ({ requestId, cuts, stockLengths, kerf, timeBudgetMs }) => {
  if (!Engine || typeof Engine.evaluatePackingExact !== "function") {
    postSolveError(requestId, "Exact solver engine unavailable.");
    return;
  }

  if (cancelledRequests.has(requestId)) {
    cancelledRequests.delete(requestId);
    return;
  }

  let wasmSolver = null;
  try {
    wasmSolver = await loadWasmSolver();
  } catch (_error) {
    wasmSolver = null;
  }
  if (cancelledRequests.has(requestId)) {
    cancelledRequests.delete(requestId);
    return;
  }

  try {
    let result;
    let solverBackend = "js";
    if (wasmSolver && typeof wasmSolver.solve === "function") {
      result = await wasmSolver.solve({ cuts, stockLengths, kerf, timeBudgetMs });
      solverBackend = "wasm";
    } else {
      result = Engine.evaluatePackingExact(cuts, stockLengths, kerf, {
        timeBudgetMs,
        shouldAbort: () => cancelledRequests.has(requestId)
      });
    }

    if (cancelledRequests.has(requestId)) {
      cancelledRequests.delete(requestId);
      return;
    }

    self.postMessage({
      type: "solveResult",
      requestId,
      ok: true,
      result: {
        ...result,
        solverBackend
      }
    });
  } catch (error) {
    postSolveError(requestId, error instanceof Error ? error.message : "Exact solve failed.");
  }
};

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "cancel" && typeof message.requestId === "number") {
    cancelledRequests.add(message.requestId);
    return;
  }

  if (message.type !== "solve") {
    return;
  }

  const requestId = Number(message.requestId);
  if (!Number.isFinite(requestId)) {
    return;
  }

  cancelledRequests.delete(requestId);
  solveWithExact({
    requestId,
    cuts: Array.isArray(message.cuts) ? message.cuts : [],
    stockLengths: Array.isArray(message.stockLengths) ? message.stockLengths : [],
    kerf: Number(message.kerf) || 0,
    timeBudgetMs: Number(message.timeBudgetMs) || 3000
  });
};
