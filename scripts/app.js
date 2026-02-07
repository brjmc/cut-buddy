(() => {
  const planView = document.getElementById("planView");
  const recordView = document.getElementById("recordView");
  const goRecordFromPlanButton = document.getElementById("goRecordFromPlan");

  const recordCanvas = document.getElementById("recordCanvas");
  const recordUnitBadge = document.getElementById("recordUnitBadge");
  const recordLatestAccepted = document.getElementById("recordLatestAccepted");
  const recordGroupedList = document.getElementById("recordGroupedList");
  const recordToggleListeningButton = document.getElementById("recordToggleListening");
  const correctionPanel = document.getElementById("correctionPanel");
  const correctionPrompt = document.getElementById("correctionPrompt");
  const correctionInput = document.getElementById("correctionInput");
  const applyCorrectionButton = document.getElementById("applyCorrection");
  const dismissCorrectionButton = document.getElementById("dismissCorrection");

  const slider = document.getElementById("confidenceRange");
  const labelEl = document.getElementById("confidenceLabel");
  const scoreEl = document.getElementById("confidenceScore");
  const presetButtons = document.querySelectorAll(".pill[data-confidence]");

  const recordingStatus = document.getElementById("recordingStatus");
  const speechSupport = document.getElementById("speechSupport");
  const undoLastCutButton = document.getElementById("undoLastCut");
  const clearCutsButton = document.getElementById("clearCuts");

  const unitSelect = document.getElementById("unitSelect");
  const liveTranscript = document.getElementById("liveTranscript");

  const cutsList = document.getElementById("cutsList");
  const cutsCount = document.getElementById("cutsCount");
  const cutsTotalLength = document.getElementById("cutsTotalLength");
  const cutsLongest = document.getElementById("cutsLongest");
  const cutsAverage = document.getElementById("cutsAverage");

  const stockInput = document.getElementById("stockInput");
  const stockPills = document.getElementById("stockPills");
  const stockPreviewLabel = document.getElementById("stockPreviewLabel");
  const kerfInput = document.getElementById("kerfInput");
  const solverModeSelect = document.getElementById("solverModeSelect");
  const calculatePlanButton = document.getElementById("calculatePlan");
  const saveStateButton = document.getElementById("saveState");
  const stockStatus = document.getElementById("stockStatus");

  const solverTag = document.getElementById("solverTag");
  const metricStockPieces = document.getElementById("metricStockPieces");
  const metricWaste = document.getElementById("metricWaste");
  const metricUtilization = document.getElementById("metricUtilization");
  const metricKerfImpact = document.getElementById("metricKerfImpact");
  const resultSummary = document.getElementById("resultSummary");
  const solverStatus = document.getElementById("solverStatus");
  const patternsList = document.getElementById("patternsList");
  const resultsSection = document.getElementById("resultsSection");
  const resultsHeading = document.getElementById("resultsHeading");
  const Engine = window.CutBuddyEngine;

  if (
    !planView ||
    !recordView ||
    !goRecordFromPlanButton ||
    !recordCanvas ||
    !recordUnitBadge ||
    !recordLatestAccepted ||
    !recordGroupedList ||
    !recordToggleListeningButton ||
    !correctionPanel ||
    !correctionPrompt ||
    !correctionInput ||
    !applyCorrectionButton ||
    !dismissCorrectionButton ||
    !slider ||
    !labelEl ||
    !scoreEl ||
    !recordingStatus ||
    !speechSupport ||
    !undoLastCutButton ||
    !clearCutsButton ||
    !unitSelect ||
    !liveTranscript ||
    !cutsList ||
    !cutsCount ||
    !cutsTotalLength ||
    !cutsLongest ||
    !cutsAverage ||
    !stockInput ||
    !stockPills ||
    !stockPreviewLabel ||
    !kerfInput ||
    !solverModeSelect ||
    !calculatePlanButton ||
    !saveStateButton ||
    !stockStatus ||
    !solverTag ||
    !metricStockPieces ||
    !metricWaste ||
    !metricUtilization ||
    !metricKerfImpact ||
    !resultSummary ||
    !solverStatus ||
    !patternsList ||
    !resultsSection ||
    !resultsHeading ||
    !Engine
  ) {
    return;
  }

  const STORAGE_KEY = "cut-buddy-state-v2";
  const CONFIDENCE_STATES = [
    {
      min: 0.75,
      label: "Clear interpretation",
      gradient: "linear-gradient(140deg, #9cdcb0, #8ae4c8)",
      textColor: "#09283a"
    },
    {
      min: 0.45,
      label: "Need a quick check",
      gradient: "linear-gradient(140deg, #ffe09f, #ffc07a)",
      textColor: "#402006"
    },
    {
      min: 0,
      label: "Low confidence, verify",
      gradient: "linear-gradient(140deg, #ff9a95, #ff6376)",
      textColor: "#3a060d"
    }
  ];

  const UNIT_META = {
    inches: { label: "inches", short: "in" },
    feet: { label: "feet", short: "ft" },
    cm: { label: "centimeters", short: "cm" },
    mm: { label: "millimeters", short: "mm" }
  };
  const METRIC_STOCK_MM = [2400, 3000, 3600];
  const SOLVER_MODES = new Set(["heuristic", "exact", "auto"]);
  const EXACT_GUARDRAILS = {
    maxCutsForExact: 50,
    exactTimeBudgetMs: 3000
  };
  const DEFAULT_STOCK_PRESETS = {
    inches: [96, 144, 192],
    feet: [96, 144, 192],
    cm: METRIC_STOCK_MM.map((value) => value / 25.4),
    mm: METRIC_STOCK_MM.map((value) => value / 25.4)
  };

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SpeechSynthesis = window.speechSynthesis;

  const state = {
    mode: "plan",
    unit: "inches",
    cuts: [],
    isListening: false,
    shouldListen: false,
    recognition: null,
    kerf: 0.125,
    stockLengths: [...DEFAULT_STOCK_PRESETS.inches],
    lastResult: null,
    solverMode: "auto",
    exactWorker: null,
    exactRequestId: 0,
    activeExactRequestId: null
  };

  const clampConfidence = (value) => {
    if (Number.isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
  };

  const gcd = (a, b) => {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const temp = y;
      y = x % y;
      x = temp;
    }
    return x || 1;
  };

  const toMixedFraction = (value, maxDenominator = 64) => {
    if (!Number.isFinite(value)) return "0";

    const sign = value < 0 ? -1 : 1;
    const absolute = Math.abs(value);
    const whole = Math.floor(absolute);
    const fraction = absolute - whole;

    let bestDenominator = 1;
    let bestNumerator = 0;
    let bestError = Number.POSITIVE_INFINITY;

    for (let denominator = 1; denominator <= maxDenominator; denominator += 1) {
      const numerator = Math.round(fraction * denominator);
      const approx = numerator / denominator;
      const error = Math.abs(fraction - approx);
      if (error < bestError) {
        bestError = error;
        bestNumerator = numerator;
        bestDenominator = denominator;
      }
    }

    let nextWhole = whole;
    let numerator = bestNumerator;
    let denominator = bestDenominator;

    if (numerator === denominator) {
      nextWhole += 1;
      numerator = 0;
    }

    if (numerator > 0) {
      const divisor = gcd(numerator, denominator);
      numerator /= divisor;
      denominator /= divisor;
    }

    const signedWhole = sign < 0 ? -nextWhole : nextWhole;
    if (numerator === 0) {
      return `${signedWhole}`;
    }

    if (nextWhole === 0) {
      const prefix = sign < 0 ? "-" : "";
      return `${prefix}${numerator}/${denominator}`;
    }

    return `${signedWhole} ${numerator}/${denominator}`;
  };

  const formatByUnit = (inches, includeUnit = true) => {
    if (!Number.isFinite(inches)) return includeUnit ? "0 in" : "0";

    if (state.unit === "inches") {
      const body = toMixedFraction(inches, 64);
      return includeUnit ? `${body} in` : body;
    }

    if (state.unit === "feet") {
      const body = toMixedFraction(inches / 12, 64);
      return includeUnit ? `${body} ft` : body;
    }

    if (state.unit === "cm") {
      const value = Number.parseFloat((inches * 2.54).toFixed(4));
      return includeUnit ? `${value} cm` : `${value}`;
    }

    const value = Number.parseFloat((inches * 25.4).toFixed(3));
    return includeUnit ? `${value} mm` : `${value}`;
  };

  const getDefaultUnitLabel = () => {
    return UNIT_META[state.unit].label;
  };

  const speakText = (text) => {
    if (!SpeechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    SpeechSynthesis.cancel();
    SpeechSynthesis.speak(utterance);
  };

  const getConfidenceState = (value) => {
    return CONFIDENCE_STATES.find((entry) => value >= entry.min) || CONFIDENCE_STATES[2];
  };

  const applyConfidence = (value) => {
    const confidence = clampConfidence(value);
    const confidenceState = getConfidenceState(confidence);
    const percent = Math.round(confidence * 100);

    recordCanvas.style.setProperty("--confidence-color", confidenceState.gradient);
    recordCanvas.style.background = confidenceState.gradient;
    recordCanvas.style.color = confidenceState.textColor;
    labelEl.textContent = confidenceState.label;
    scoreEl.textContent = `${percent}%`;
    slider.value = confidence.toString();
    slider.setAttribute("aria-valuenow", confidence.toFixed(2));
    recordCanvas.setAttribute("aria-label", `${confidenceState.label} at ${percent} percent confidence`);
  };

  const setSupportText = (text, isError = false) => {
    speechSupport.textContent = text;
    speechSupport.classList.toggle("is-error", isError);
  };

  const updateModeUI = () => {
    const isRecordMode = state.mode === "record";
    planView.hidden = isRecordMode;
    recordView.hidden = !isRecordMode;
    document.body.classList.toggle("record-mode-active", isRecordMode);
  };

  const updateRecordingUI = () => {
    const active = state.shouldListen || state.isListening;
    recordingStatus.textContent = active ? "Recorder live" : "Recorder idle";
    recordToggleListeningButton.textContent = active ? "Stop recording" : "Start recording";
    recordToggleListeningButton.classList.toggle("is-live", active);
  };

  const updateUnitUI = () => {
    unitSelect.value = state.unit;
    recordUnitBadge.textContent = getDefaultUnitLabel();
  };

  const hideCorrectionPanel = () => {
    correctionPanel.hidden = true;
    correctionPrompt.textContent = "";
    correctionInput.value = "";
  };

  const scrollToResultsAfterRecordExit = () => {
    const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = prefersReducedMotion ? "auto" : "smooth";

    requestAnimationFrame(() => {
      resultsSection.scrollIntoView({ behavior, block: "start" });
      window.setTimeout(() => {
        try {
          resultsHeading.focus({ preventScroll: true });
        } catch (_error) {
          resultsHeading.focus();
        }
      }, prefersReducedMotion ? 0 : 180);
    });
  };

  const showCorrectionPanel = (phrase) => {
    correctionPanel.hidden = false;
    correctionPrompt.textContent = `Could not parse: "${phrase}"`;
    correctionInput.value = phrase;
    correctionInput.focus();
    correctionInput.select();
  };

  const addCorrectedCut = (phrase, shouldSpeak = false) => {
    const correctedPhrase = phrase.trim();
    if (!correctedPhrase) return false;

    const measurement = parseMeasurement(correctedPhrase);
    if (!measurement) return false;

    cancelInFlightExactSolve();
    state.cuts.push(measurement);
    renderCuts();
    recordLatestAccepted.textContent = `${formatByUnit(measurement.totalInches, false)} ${UNIT_META[state.unit].short} ✅`;
    liveTranscript.textContent = `Corrected: ${correctedPhrase}`;
    hideCorrectionPanel();

    if (shouldSpeak) {
      speakText(measurement.raw);
    }

    return true;
  };

  const parseMeasurement = (phrase) => Engine.parseMeasurement(phrase, state.unit);
  const parseStockInput = (text) => Engine.parseStockInput(text, state.unit);

  const applyDefaultStockPresetForUnit = (unit) => {
    const preset = DEFAULT_STOCK_PRESETS[unit];
    if (!preset) return;
    state.stockLengths = [...preset];
  };

  const nextExactRequestId = () => {
    state.exactRequestId += 1;
    return state.exactRequestId;
  };

  const ensureExactWorker = () => {
    if (state.exactWorker) return state.exactWorker;
    if (!("Worker" in window)) return null;

    try {
      const worker = new Worker("scripts/exact-solver-worker.js");
      worker.addEventListener("message", (event) => {
        const message = event.data || {};
        if (message.type !== "solveResult") return;

        if (message.requestId !== state.activeExactRequestId) {
          return;
        }

        state.activeExactRequestId = null;

        if (!message.ok) {
          if (state.lastResult) {
            state.lastResult.solverUsed = "heuristic_fallback";
            state.lastResult.optimality = "not_proven";
            state.lastResult.solverStatus = "Exact solve failed. Showing heuristic result.";
          }
          stockStatus.textContent = message.error || "Exact solve failed. Showing heuristic result.";
          renderResults();
          return;
        }

        const exactResult = message.result || {};
        if (!state.lastResult) {
          return;
        }

        if (exactResult.termination === "completed" && exactResult.optimality === "proven_optimal") {
          const backendLabel = exactResult.solverBackend === "wasm" ? "WASM" : "JS";
          state.lastResult = {
            ...exactResult,
            algorithm: "Exact branch-and-bound (worker)",
            solverUsed: "exact",
            optimality: "proven_optimal",
            solverStatus: `Exact (${backendLabel}) completed in ${exactResult.elapsedMs} ms (${exactResult.exploredNodes} nodes).`
          };
          stockStatus.textContent = "Exact solve finished with proven optimality.";
          renderResults();
          saveLocalState();
          return;
        }

        if (exactResult.termination === "timed_out") {
          state.lastResult.solverUsed = "heuristic_fallback";
          state.lastResult.optimality = "timed_out";
          state.lastResult.solverStatus = `Exact timed out at ${EXACT_GUARDRAILS.exactTimeBudgetMs} ms. Showing heuristic result.`;
          stockStatus.textContent = state.lastResult.solverStatus;
          renderResults();
          return;
        }

        state.lastResult.solverUsed = "heuristic_fallback";
        state.lastResult.optimality = "not_proven";
        state.lastResult.solverStatus = "Exact run cancelled or unavailable. Showing heuristic result.";
        stockStatus.textContent = state.lastResult.solverStatus;
        renderResults();
      });
      state.exactWorker = worker;
      return worker;
    } catch (_error) {
      return null;
    }
  };

  const cancelInFlightExactSolve = () => {
    if (!state.exactWorker || !Number.isFinite(state.activeExactRequestId)) {
      state.activeExactRequestId = null;
      return;
    }

    state.exactWorker.postMessage({
      type: "cancel",
      requestId: state.activeExactRequestId
    });
    state.activeExactRequestId = null;
  };

  const createResultModel = (result, metadata) => ({
    ...result,
    algorithm: metadata.algorithm,
    solverUsed: metadata.solverUsed,
    optimality: metadata.optimality,
    solverStatus: metadata.solverStatus
  });

  const saveLocalState = () => {
    const payload = {
      unit: state.unit,
      cuts: state.cuts,
      kerf: state.kerf,
      stockLengths: state.stockLengths,
      solverMode: state.solverMode
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      stockStatus.textContent = "Saved locally.";
    } catch (_error) {
      stockStatus.textContent = "Could not save local data.";
    }
  };

  const loadLocalState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const payload = JSON.parse(saved);
      if (typeof payload.unit === "string" && UNIT_META[payload.unit]) {
        state.unit = payload.unit;
      }

      if (Array.isArray(payload.cuts)) {
        state.cuts = payload.cuts.filter((item) => Number.isFinite(item.totalInches));
      }

      if (Array.isArray(payload.stockLengths) && payload.stockLengths.length) {
        state.stockLengths = payload.stockLengths
          .filter((item) => Number.isFinite(item) && item > 0)
          .sort((a, b) => a - b);
      }

      if (Number.isFinite(payload.kerf) && payload.kerf >= 0) {
        state.kerf = payload.kerf;
      }

      if (typeof payload.solverMode === "string" && SOLVER_MODES.has(payload.solverMode)) {
        state.solverMode = payload.solverMode;
      }
    } catch (_error) {
      // Ignore malformed payload.
    }
  };

  const renderRecordSummary = () => {
    recordGroupedList.innerHTML = "";

    if (!state.cuts.length) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = "No cuts captured yet";
      recordGroupedList.appendChild(emptyItem);
      return;
    }

    const grouped = new Map();
    state.cuts.forEach((cut) => {
      const key = formatByUnit(cut.totalInches, false);
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(key, { key, count: 1, numeric: cut.totalInches });
      }
    });

    const sorted = [...grouped.values()].sort((a, b) => b.count - a.count || b.numeric - a.numeric);
    sorted.slice(0, 8).forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = `${entry.key} x ${entry.count}`;
      recordGroupedList.appendChild(item);
    });
  };

  const renderCuts = () => {
    cutsList.innerHTML = "";

    state.cuts.forEach((cut, index) => {
      const item = document.createElement("li");
      item.className = "cut-item";

      const row = document.createElement("div");
      row.className = "cut-row";

      const text = document.createElement("span");
      text.className = "cut-phrase";
      text.textContent = `${index + 1}. ${cut.raw}`;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        cancelInFlightExactSolve();
        state.cuts = state.cuts.filter((entry) => entry.id !== cut.id);
        renderCuts();
        renderResults();
      });

      row.append(text, removeButton);

      const meta = document.createElement("p");
      meta.className = "cut-meta";
      meta.textContent = `Parsed: ${formatByUnit(cut.totalInches)}`;

      const editRow = document.createElement("div");
      editRow.className = "cut-edit";

      const editInput = document.createElement("input");
      editInput.type = "number";
      editInput.step = "0.001";
      editInput.min = "0";
      editInput.value = String(cut.totalInches);

      const updateButton = document.createElement("button");
      updateButton.type = "button";
      updateButton.className = "ghost-button";
      updateButton.textContent = "Update";
      updateButton.addEventListener("click", () => {
        const nextValue = Number.parseFloat(editInput.value);
        if (!Number.isFinite(nextValue) || nextValue <= 0) {
          stockStatus.textContent = "Cut value must be greater than 0.";
          return;
        }
        cancelInFlightExactSolve();
        cut.totalInches = nextValue;
        cut.raw = formatByUnit(cut.totalInches);
        renderCuts();
        renderResults();
      });

      const duplicateButton = document.createElement("button");
      duplicateButton.type = "button";
      duplicateButton.className = "ghost-button";
      duplicateButton.textContent = "Duplicate";
      duplicateButton.addEventListener("click", () => {
        cancelInFlightExactSolve();
        state.cuts.push({
          ...cut,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          raw: `${cut.raw} (dup)`
        });
        renderCuts();
      });

      editRow.append(editInput, updateButton, duplicateButton);
      item.append(row, meta, editRow);
      cutsList.appendChild(item);
    });

    cutsCount.textContent = `${state.cuts.length} ${state.cuts.length === 1 ? "item" : "items"}`;
    const lengths = state.cuts.map((cut) => cut.totalInches);
    const totalLength = lengths.reduce((sum, value) => sum + value, 0);
    const longest = lengths.length ? Math.max(...lengths) : 0;
    const average = lengths.length ? totalLength / lengths.length : 0;

    cutsTotalLength.textContent = formatByUnit(totalLength);
    cutsLongest.textContent = formatByUnit(longest);
    cutsAverage.textContent = formatByUnit(average);

    renderRecordSummary();
    saveLocalState();
  };

  const renderStockPreview = () => {
    const previewLengths = parseStockInput(stockInput.value);
    stockPills.innerHTML = "";

    previewLengths.forEach((length) => {
      const pill = document.createElement("span");
      pill.className = "stock-pill";
      pill.textContent = formatByUnit(length);
      stockPills.appendChild(pill);
    });

    const label = previewLengths.length === 1 ? "option" : "options";
    stockPreviewLabel.textContent = `${previewLengths.length} ${label}`;
  };

  const renderResults = () => {
    patternsList.innerHTML = "";
    const result = state.lastResult;

    if (!result) {
      solverTag.textContent = "Not run";
      resultSummary.textContent = "Add cuts and calculate to see cutting patterns.";
      solverStatus.textContent = "Solver status will appear after calculation.";
      metricStockPieces.textContent = "--";
      metricWaste.textContent = "--";
      metricUtilization.textContent = "--";
      metricKerfImpact.textContent = "--";
      return;
    }

    solverTag.textContent = result.algorithm;
    resultSummary.textContent = `${result.binCount} stock pieces | ${formatByUnit(result.totalWaste)} waste | ${formatByUnit(result.totalUsed)} used`;
    solverStatus.textContent = result.solverStatus || "";

    metricStockPieces.textContent = String(result.binCount);
    metricWaste.textContent = formatByUnit(result.totalWaste);
    metricUtilization.textContent = `${(result.utilization * 100).toFixed(1)}%`;
    metricKerfImpact.textContent = formatByUnit(result.totalKerfLoss);

    result.bins.forEach((bin, index) => {
      const item = document.createElement("li");
      item.className = "pattern-item";

      const header = document.createElement("p");
      header.className = "pattern-header";
      header.textContent = `${index + 1}. Stock ${formatByUnit(bin.stockLength)}`;

      const track = document.createElement("div");
      track.className = "pattern-track";
      const total = bin.stockLength || 1;

      bin.cuts.forEach((cutLength) => {
        const segment = document.createElement("span");
        segment.className = "pattern-segment cut";
        segment.style.width = `${Math.max(0, (cutLength / total) * 100)}%`;
        segment.title = formatByUnit(cutLength);
        track.appendChild(segment);
      });

      if (bin.remaining > 0) {
        const wasteSegment = document.createElement("span");
        wasteSegment.className = "pattern-segment waste";
        wasteSegment.style.width = `${Math.max(0, (bin.remaining / total) * 100)}%`;
        wasteSegment.title = `Waste ${formatByUnit(bin.remaining)}`;
        track.appendChild(wasteSegment);
      }

      const detail = document.createElement("p");
      detail.className = "pattern-detail";
      const cutsText = bin.cuts.map((cut) => formatByUnit(cut)).join(", ");
      detail.textContent = `Cuts: ${cutsText} | Waste: ${formatByUnit(bin.remaining)}`;

      item.append(header, track, detail);
      patternsList.appendChild(item);
    });
  };

  const addCutFromPhrase = (sourceText = "", shouldSpeak = false) => {
    const phrase = sourceText.trim();
    if (!phrase) return;

    const normalized = phrase.toLowerCase();
    if (normalized.includes("undo")) {
      cancelInFlightExactSolve();
      state.cuts.pop();
      liveTranscript.textContent = "Last cut removed.";
      renderCuts();
      return;
    }

    if (normalized.includes("clear")) {
      cancelInFlightExactSolve();
      state.cuts = [];
      state.lastResult = null;
      liveTranscript.textContent = "Cut list cleared.";
      renderCuts();
      renderResults();
      return;
    }

    if (normalized.includes("calculate")) {
      runOptimization();
      return;
    }

    const measurement = parseMeasurement(phrase);
    liveTranscript.textContent = phrase;

    if (!measurement) {
      liveTranscript.textContent = `Could not parse: \"${phrase}\"`;
      setSupportText(`Could not parse: "${phrase}"`, true);
      applyConfidence(0.2);
      showCorrectionPanel(phrase);
      return;
    }

    setSupportText("Speech recognition active.");
    hideCorrectionPanel();
    cancelInFlightExactSolve();
    state.cuts.push(measurement);
    renderCuts();

    const acceptedText = `${formatByUnit(measurement.totalInches, false)} ${UNIT_META[state.unit].short} ✅`;
    recordLatestAccepted.textContent = acceptedText;

    if (shouldSpeak) {
      speakText(measurement.raw);
    }
  };

  const mapSpeechError = (errorCode) => {
    if (errorCode === "not-allowed") return "Microphone permission denied.";
    if (errorCode === "audio-capture") return "No microphone input detected.";
    if (errorCode === "network") return "Speech service network issue.";
    if (errorCode === "no-speech") return "No speech detected.";
    if (errorCode === "aborted") return "Recognition stopped.";
    return "Speech recognition error.";
  };

  const stopListening = () => {
    state.shouldListen = false;
    if (state.recognition && state.isListening) {
      state.recognition.stop();
    }
    state.isListening = false;
    updateRecordingUI();
  };

  const startListening = () => {
    if (!state.recognition) {
      setSupportText("SpeechRecognition is not supported in this browser.", true);
      return;
    }

    state.shouldListen = true;
    liveTranscript.textContent = "Listening for length phrases...";

    try {
      state.recognition.start();
    } catch (_error) {
      // Engine may throw if already active.
    }

    updateRecordingUI();
  };

  const setupRecognition = () => {
    if (!SpeechRecognition) {
      setSupportText("SpeechRecognition is not supported in this browser.", true);
      return;
    }

    state.recognition = new SpeechRecognition();
    state.recognition.lang = "en-US";
    state.recognition.interimResults = true;
    state.recognition.continuous = true;
    state.recognition.maxAlternatives = 1;

    setSupportText("Speech recognition ready. Open Record to capture cuts.");

    state.recognition.onstart = () => {
      state.isListening = true;
      updateRecordingUI();
    };

    state.recognition.onresult = (event) => {
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const best = result[0];
        if (!best) continue;

        const confidence = clampConfidence(best.confidence);
        if (confidence > 0) applyConfidence(confidence);

        if (result.isFinal) {
          const finalText = best.transcript.trim();
          if (finalText) {
            liveTranscript.textContent = finalText;
            addCutFromPhrase(finalText, true);
          }
        } else {
          interimText += `${best.transcript} `;
        }
      }

      const compactInterim = interimText.trim();
      if (compactInterim) {
        liveTranscript.textContent = compactInterim;
      }
    };

    state.recognition.onerror = (event) => {
      const errorMessage = mapSpeechError(event.error);
      setSupportText(errorMessage, true);
      liveTranscript.textContent = errorMessage;

      if (event.error === "not-allowed" || event.error === "audio-capture") {
        state.shouldListen = false;
      }
    };

    state.recognition.onend = () => {
      state.isListening = false;
      if (state.shouldListen) {
        try {
          state.recognition.start();
          return;
        } catch (_error) {
          // Wait for manual restart.
        }
      }
      updateRecordingUI();
    };
  };

  const evaluatePacking = (cutLengths, stockLengths, kerf) =>
    Engine.evaluatePacking(cutLengths, stockLengths, kerf);

  const shouldAttemptExactSolve = (cutCount) => {
    if (state.solverMode === "heuristic") {
      return { allowed: false, reason: "Heuristic mode selected." };
    }

    if (cutCount > EXACT_GUARDRAILS.maxCutsForExact) {
      return {
        allowed: false,
        reason: `Exact skipped: ${cutCount} cuts exceeds limit ${EXACT_GUARDRAILS.maxCutsForExact}.`
      };
    }

    return { allowed: true, reason: "" };
  };

  const runExactSolveInWorker = ({ cuts, stockLengths, kerf }) => {
    const worker = ensureExactWorker();
    if (!worker) {
      if (state.lastResult) {
        state.lastResult.solverUsed = "heuristic_fallback";
        state.lastResult.optimality = "not_proven";
        state.lastResult.solverStatus = "Exact unavailable in this browser. Showing heuristic result.";
      }
      stockStatus.textContent = "Exact unavailable in this browser. Showing heuristic result.";
      renderResults();
      return;
    }

    const requestId = nextExactRequestId();
    state.activeExactRequestId = requestId;
    worker.postMessage({
      type: "solve",
      requestId,
      cuts,
      stockLengths,
      kerf,
      timeBudgetMs: EXACT_GUARDRAILS.exactTimeBudgetMs
    });
  };

  const runOptimization = () => {
    cancelInFlightExactSolve();

    const stockLengths = parseStockInput(stockInput.value);
    const kerf = Number.parseFloat(kerfInput.value);

    if (!stockLengths.length) {
      stockStatus.textContent = `Add valid stock lengths (default unit: ${getDefaultUnitLabel()}).`;
      return;
    }

    if (!Number.isFinite(kerf) || kerf < 0) {
      stockStatus.textContent = "Kerf must be 0 or greater.";
      return;
    }

    if (!state.cuts.length) {
      stockStatus.textContent = "Add at least one cut before calculating.";
      return;
    }

    state.stockLengths = stockLengths;
    state.kerf = kerf;

    try {
      const cuts = state.cuts.map((cut) => cut.totalInches);
      const heuristic = evaluatePacking(cuts, stockLengths, kerf);
      const exactEligibility = shouldAttemptExactSolve(cuts.length);

      const shouldQueueExact = exactEligibility.allowed && (state.solverMode === "auto" || state.solverMode === "exact");
      const heuristicStatus = shouldQueueExact
        ? `Heuristic preview shown. Running exact for up to ${EXACT_GUARDRAILS.exactTimeBudgetMs} ms.`
        : exactEligibility.reason || "Heuristic mode selected.";

      state.lastResult = createResultModel(heuristic, {
        algorithm: shouldQueueExact ? "Best Fit Decreasing (preview)" : "Best Fit Decreasing",
        solverUsed: shouldQueueExact ? "heuristic" : "heuristic",
        optimality: shouldQueueExact ? "not_proven" : "not_proven",
        solverStatus: heuristicStatus
      });

      if (state.solverMode === "exact" && !exactEligibility.allowed) {
        state.lastResult.solverUsed = "heuristic_fallback";
        state.lastResult.optimality = "not_proven";
        state.lastResult.solverStatus = `${exactEligibility.reason} Falling back to heuristic.`;
      }

      if (shouldQueueExact) {
        runExactSolveInWorker({ cuts, stockLengths, kerf });
      }

      stockStatus.textContent = shouldQueueExact
        ? `Heuristic preview ready. Exact solving in background (${cuts.length} cuts).`
        : `Calculated with ${state.cuts.length} cuts across ${stockLengths.length} stock sizes.`;
      renderResults();
      saveLocalState();
    } catch (error) {
      stockStatus.textContent = error instanceof Error ? error.message : "Calculation failed.";
    }
  };

  const hydrateInputs = () => {
    kerfInput.value = String(state.kerf);
    stockInput.value = state.stockLengths.map((length) => formatByUnit(length)).join(", ");
    solverModeSelect.value = state.solverMode;
    updateUnitUI();
    renderStockPreview();
  };

  const setMode = (mode) => {
    state.mode = mode;
    updateModeUI();
  };

  const enterRecordMode = () => {
    setMode("record");
    hideCorrectionPanel();
    startListening();
    recordToggleListeningButton.focus();
  };

  const exitRecordMode = () => {
    stopListening();
    hideCorrectionPanel();
    setMode("plan");
    scrollToResultsAfterRecordExit();
  };

  const setupServiceWorker = () => {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // Keep the app functional even if registration fails.
      });
    });
  };

  slider.addEventListener("input", (event) => {
    applyConfidence(Number.parseFloat(event.target.value));
  });

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const value = Number.parseFloat(button.dataset.confidence || "0");
      applyConfidence(value);
    });
  });

  goRecordFromPlanButton.addEventListener("click", () => enterRecordMode());

  recordToggleListeningButton.addEventListener("click", () => {
    if (state.shouldListen || state.isListening) {
      exitRecordMode();
    } else {
      enterRecordMode();
    }
  });

  applyCorrectionButton.addEventListener("click", () => {
    const success = addCorrectedCut(correctionInput.value, false);
    if (!success) {
      correctionPrompt.textContent = `Still could not parse: "${correctionInput.value.trim()}"`;
      correctionInput.focus();
      correctionInput.select();
    }
  });

  dismissCorrectionButton.addEventListener("click", () => {
    hideCorrectionPanel();
    liveTranscript.textContent = "Correction dismissed.";
  });

  correctionInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyCorrectionButton.click();
  });

  undoLastCutButton.addEventListener("click", () => {
    cancelInFlightExactSolve();
    state.cuts.pop();
    renderCuts();
    renderResults();
  });

  clearCutsButton.addEventListener("click", () => {
    cancelInFlightExactSolve();
    state.cuts = [];
    state.lastResult = null;
    liveTranscript.textContent = "Cut list cleared.";
    recordLatestAccepted.textContent = "Waiting for a cut...";
    hideCorrectionPanel();
    renderCuts();
    renderResults();
  });

  calculatePlanButton.addEventListener("click", () => {
    runOptimization();
  });

  saveStateButton.addEventListener("click", () => {
    saveLocalState();
  });

  stockInput.addEventListener("input", () => {
    cancelInFlightExactSolve();
    renderStockPreview();
  });

  kerfInput.addEventListener("input", () => {
    cancelInFlightExactSolve();
  });

  unitSelect.addEventListener("change", (event) => {
    cancelInFlightExactSolve();
    const nextUnit = event.target.value;
    if (!UNIT_META[nextUnit]) return;

    state.unit = nextUnit;
    applyDefaultStockPresetForUnit(nextUnit);
    state.lastResult = null;
    stockStatus.textContent = `Stock presets updated for ${UNIT_META[nextUnit].label}.`;
    updateUnitUI();
    hydrateInputs();
    renderCuts();
    renderResults();
  });

  solverModeSelect.addEventListener("change", (event) => {
    const nextMode = event.target.value;
    if (!SOLVER_MODES.has(nextMode)) return;
    cancelInFlightExactSolve();
    state.solverMode = nextMode;
    saveLocalState();
    stockStatus.textContent = `Solver mode set to ${nextMode}.`;
    if (state.lastResult) {
      state.lastResult.solverStatus = "Solver mode changed. Recalculate to apply.";
      renderResults();
    }
  });

  loadLocalState();
  hydrateInputs();
  hideCorrectionPanel();
  setupRecognition();
  setupServiceWorker();
  updateModeUI();
  updateRecordingUI();
  renderCuts();
  renderResults();
  applyConfidence(Number.parseFloat(slider.value));
})();
