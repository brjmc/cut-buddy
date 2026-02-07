/* global CutBuddyEngine */

importScripts("./engine.js");

const Engine = self.CutBuddyEngine;
const cancelledRequests = new Set();

const sendError = (requestId, error) => {
  self.postMessage({
    type: "error",
    requestId,
    message: error instanceof Error ? error.message : String(error)
  });
};

const runApprox = ({ requestId, cuts, stockLengths, kerf, timeBudgetMs, seed }) => {
  if (!Engine || typeof Engine.evaluatePackingApprox !== "function") {
    sendError(requestId, new Error("Approximate solver engine unavailable."));
    return;
  }

  if (cancelledRequests.has(requestId)) {
    cancelledRequests.delete(requestId);
    return;
  }

  try {
    const result = Engine.evaluatePackingApprox(cuts, stockLengths, kerf, {
      timeBudgetMs,
      seed,
      progressIntervalMs: 220,
      shouldAbort: () => cancelledRequests.has(requestId),
      onProgress: (progress) => {
        if (cancelledRequests.has(requestId)) return;
        self.postMessage({
          type: "progress",
          requestId,
          progress
        });
      },
      onImprovement: (payload) => {
        if (cancelledRequests.has(requestId)) return;
        self.postMessage({
          type: "improvement",
          requestId,
          improvement: payload
        });
      }
    });

    if (cancelledRequests.has(requestId)) {
      cancelledRequests.delete(requestId);
      return;
    }

    self.postMessage({
      type: "done",
      requestId,
      result
    });
  } catch (error) {
    if (cancelledRequests.has(requestId)) {
      cancelledRequests.delete(requestId);
      return;
    }
    sendError(requestId, error);
  }
};

self.onmessage = (event) => {
  const message = event.data || {};
  const requestId = Number(message.requestId);

  if (!Number.isFinite(requestId)) {
    return;
  }

  if (message.type === "cancel") {
    cancelledRequests.add(requestId);
    return;
  }

  if (message.type !== "start") {
    return;
  }

  cancelledRequests.delete(requestId);

  runApprox({
    requestId,
    cuts: Array.isArray(message.cuts) ? message.cuts : [],
    stockLengths: Array.isArray(message.stockLengths) ? message.stockLengths : [],
    kerf: Number(message.kerf) || 0,
    timeBudgetMs: Number(message.timeBudgetMs) || Engine.DEFAULT_APPROX_TIME_BUDGET_MS || 2500,
    seed: Number.isFinite(Number(message.seed)) ? Number(message.seed) : Date.now()
  });
};
