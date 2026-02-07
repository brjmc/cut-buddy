(() => {
  const planView = document.getElementById("planView");
  const recordView = document.getElementById("recordView");
  const goRecordFromPlanButton = document.getElementById("goRecordFromPlan");

  const recordCanvas = document.getElementById("recordCanvas");
  const recordUnitBadge = document.getElementById("recordUnitBadge");
  const recordLatestAccepted = document.getElementById("recordLatestAccepted");
  const recordGroupedList = document.getElementById("recordGroupedList");
  const recordToggleListeningButton = document.getElementById("recordToggleListening");

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
  const calculatePlanButton = document.getElementById("calculatePlan");
  const saveStateButton = document.getElementById("saveState");
  const stockStatus = document.getElementById("stockStatus");

  const solverTag = document.getElementById("solverTag");
  const metricStockPieces = document.getElementById("metricStockPieces");
  const metricWaste = document.getElementById("metricWaste");
  const metricUtilization = document.getElementById("metricUtilization");
  const metricKerfImpact = document.getElementById("metricKerfImpact");
  const resultSummary = document.getElementById("resultSummary");
  const patternsList = document.getElementById("patternsList");

  if (
    !planView ||
    !recordView ||
    !goRecordFromPlanButton ||
    !recordCanvas ||
    !recordUnitBadge ||
    !recordLatestAccepted ||
    !recordGroupedList ||
    !recordToggleListeningButton ||
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
    !calculatePlanButton ||
    !saveStateButton ||
    !stockStatus ||
    !solverTag ||
    !metricStockPieces ||
    !metricWaste ||
    !metricUtilization ||
    !metricKerfImpact ||
    !resultSummary ||
    !patternsList
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
  const DEFAULT_STOCK_PRESETS = {
    inches: [96, 144, 192],
    feet: [96, 144, 192],
    cm: METRIC_STOCK_MM.map((value) => value / 25.4),
    mm: METRIC_STOCK_MM.map((value) => value / 25.4)
  };

  const SMALL_NUMBERS = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19
  };

  const TENS_NUMBERS = {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90
  };

  const FEET_UNITS = new Set(["foot", "feet", "ft"]);
  const INCH_UNITS = new Set(["inch", "inches", "in"]);
  const CM_UNITS = new Set(["cm", "centimeter", "centimeters"]);
  const MM_UNITS = new Set(["mm", "millimeter", "millimeters"]);
  const M_UNITS = new Set(["m", "meter", "meters"]);

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
    lastResult: null
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

  const toInchesFromDefaultUnit = (value) => {
    if (state.unit === "feet") return value * 12;
    if (state.unit === "cm") return value / 2.54;
    if (state.unit === "mm") return value / 25.4;
    return value;
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

  const tokenize = (text) => {
    return text
      .replace(/(\d)\s*'\s*/g, "$1 feet ")
      .replace(/(\d)\s*"\s*/g, "$1 inches ")
      .toLowerCase()
      .replace(/-/g, " ")
      .replace(/[^\w./\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  };

  const parseFractionToken = (token) => {
    const normalized = token.replace(/^(\d+)\/(\d+)(?:st|nd|rd|th|ths)?$/i, "$1/$2");
    const match = normalized.match(/^(\d+)\/(\d+)$/);
    if (!match) return null;

    const numerator = Number.parseInt(match[1], 10);
    const denominator = Number.parseInt(match[2], 10);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }

    return numerator / denominator;
  };

  const readAmount = (tokens, start) => {
    let index = start;
    let hasNumberContent = false;
    let current = 0;

    while (index < tokens.length) {
      const token = tokens[index];
      const fractionToken = parseFractionToken(token);
      const numericToken = Number.parseFloat(token);

      if (fractionToken !== null) {
        current += fractionToken;
        hasNumberContent = true;
        index += 1;
        continue;
      }

      if (token.includes("/")) {
        return { invalidFractionToken: true, nextIndex: index };
      }

      if (Number.isFinite(numericToken)) {
        current += numericToken;
        hasNumberContent = true;
        index += 1;
        continue;
      }

      if (token in SMALL_NUMBERS) {
        current += SMALL_NUMBERS[token];
        hasNumberContent = true;
        index += 1;
        continue;
      }

      if (token in TENS_NUMBERS) {
        current += TENS_NUMBERS[token];
        hasNumberContent = true;
        index += 1;
        continue;
      }

      if (token === "hundred") {
        current = (current || 1) * 100;
        hasNumberContent = true;
        index += 1;
        continue;
      }

      if (token === "half") {
        current += 0.5;
        hasNumberContent = true;
        index += 1;
        continue;
      }

      if (token === "quarter") {
        current += 0.25;
        hasNumberContent = true;
        index += 1;
        continue;
      }

      if (token === "and" || token === "a" || token === "an") {
        index += 1;
        continue;
      }

      break;
    }

    if (!hasNumberContent) return null;
    return { value: current, nextIndex: index };
  };

  const parseMeasurement = (phrase) => {
    const tokens = tokenize(phrase);
    if (!tokens.length) return null;

    let feet = 0;
    let inches = 0;
    let cursor = 0;

    while (cursor < tokens.length) {
      const amount = readAmount(tokens, cursor);
      if (!amount) {
        cursor += 1;
        continue;
      }
      if (amount.invalidFractionToken) {
        return null;
      }

      cursor = amount.nextIndex;
      const unitToken = tokens[cursor];

      if (unitToken && FEET_UNITS.has(unitToken)) {
        feet += amount.value;
        cursor += 1;
        continue;
      }

      if (unitToken && INCH_UNITS.has(unitToken)) {
        inches += amount.value;
        cursor += 1;
        continue;
      }

      if (unitToken && CM_UNITS.has(unitToken)) {
        inches += amount.value / 2.54;
        cursor += 1;
        continue;
      }

      if (unitToken && MM_UNITS.has(unitToken)) {
        inches += amount.value / 25.4;
        cursor += 1;
        continue;
      }

      if (unitToken && M_UNITS.has(unitToken)) {
        inches += (amount.value * 100) / 2.54;
        cursor += 1;
        continue;
      }

      inches += toInchesFromDefaultUnit(amount.value);
    }

    const totalInches = feet * 12 + inches;
    if (totalInches <= 0) return null;

    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      raw: phrase.trim(),
      totalInches
    };
  };

  const parseStockInput = (text) => {
    return text
      .split(",")
      .map((segment) => parseMeasurement(segment.trim()))
      .filter(Boolean)
      .map((entry) => entry.totalInches)
      .sort((a, b) => a - b);
  };

  const applyDefaultStockPresetForUnit = (unit) => {
    const preset = DEFAULT_STOCK_PRESETS[unit];
    if (!preset) return;
    state.stockLengths = [...preset];
  };

  const saveLocalState = () => {
    const payload = {
      unit: state.unit,
      cuts: state.cuts,
      kerf: state.kerf,
      stockLengths: state.stockLengths
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
      metricStockPieces.textContent = "--";
      metricWaste.textContent = "--";
      metricUtilization.textContent = "--";
      metricKerfImpact.textContent = "--";
      return;
    }

    solverTag.textContent = result.algorithm;
    resultSummary.textContent = `${result.binCount} stock pieces | ${formatByUnit(result.totalWaste)} waste | ${formatByUnit(result.totalUsed)} used`;

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
      state.cuts.pop();
      liveTranscript.textContent = "Last cut removed.";
      renderCuts();
      return;
    }

    if (normalized.includes("clear")) {
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
      recordLatestAccepted.textContent = "Could not parse that cut";
      applyConfidence(0.2);
      return;
    }

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

  const evaluatePacking = (cutLengths, stockLengths, kerf) => {
    const sortedCuts = [...cutLengths].sort((a, b) => b - a);
    const bins = [];

    sortedCuts.forEach((cutLength) => {
      let best = null;

      bins.forEach((bin, index) => {
        const extraKerf = bin.cuts.length === 0 ? 0 : kerf;
        const remaining = bin.remaining - cutLength - extraKerf;
        if (remaining < -1e-9) return;

        if (!best || remaining < best.remainingAfter) {
          best = { kind: "existing", index, remainingAfter: remaining, extraKerf };
        }
      });

      stockLengths.forEach((stockLength) => {
        const remaining = stockLength - cutLength;
        if (remaining < -1e-9) return;
        if (!best || remaining < best.remainingAfter) {
          best = { kind: "new", stockLength, remainingAfter: remaining, extraKerf: 0 };
        }
      });

      if (!best) {
        throw new Error(`Cut ${formatByUnit(cutLength)} exceeds all configured stock lengths.`);
      }

      if (best.kind === "existing") {
        const target = bins[best.index];
        target.cuts.push(cutLength);
        target.used += cutLength + best.extraKerf;
        target.remaining = Number.parseFloat((target.stockLength - target.used).toFixed(6));
      } else {
        bins.push({
          stockLength: best.stockLength,
          cuts: [cutLength],
          used: cutLength,
          remaining: Number.parseFloat((best.stockLength - cutLength).toFixed(6))
        });
      }
    });

    const totalUsed = bins.reduce((sum, bin) => sum + bin.used, 0);
    const totalWaste = bins.reduce((sum, bin) => sum + Math.max(0, bin.remaining), 0);
    const totalStockLength = bins.reduce((sum, bin) => sum + bin.stockLength, 0);
    const totalKerfLoss = bins.reduce((sum, bin) => {
      const cutCount = bin.cuts.length;
      if (cutCount <= 1) return sum;
      return sum + (cutCount - 1) * kerf;
    }, 0);
    const utilization = totalStockLength > 0 ? totalUsed / totalStockLength : 0;

    return {
      bins,
      binCount: bins.length,
      totalUsed: Number.parseFloat(totalUsed.toFixed(3)),
      totalWaste: Number.parseFloat(totalWaste.toFixed(3)),
      totalStockLength: Number.parseFloat(totalStockLength.toFixed(3)),
      totalKerfLoss: Number.parseFloat(totalKerfLoss.toFixed(3)),
      utilization: Number.parseFloat(utilization.toFixed(6))
    };
  };

  const runOptimization = () => {
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
      const result = evaluatePacking(cuts, stockLengths, kerf);

      state.lastResult = {
        ...result,
        algorithm: "Best Fit Decreasing"
      };

      stockStatus.textContent = `Calculated with ${state.cuts.length} cuts across ${stockLengths.length} stock sizes.`;
      renderResults();
      saveLocalState();
    } catch (error) {
      stockStatus.textContent = error instanceof Error ? error.message : "Calculation failed.";
    }
  };

  const hydrateInputs = () => {
    kerfInput.value = String(state.kerf);
    stockInput.value = state.stockLengths.map((length) => formatByUnit(length)).join(", ");
    updateUnitUI();
    renderStockPreview();
  };

  const setMode = (mode) => {
    state.mode = mode;
    updateModeUI();
  };

  const enterRecordMode = () => {
    setMode("record");
    startListening();
  };

  const exitRecordMode = () => {
    stopListening();
    setMode("plan");
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

  undoLastCutButton.addEventListener("click", () => {
    state.cuts.pop();
    renderCuts();
    renderResults();
  });

  clearCutsButton.addEventListener("click", () => {
    state.cuts = [];
    state.lastResult = null;
    liveTranscript.textContent = "Cut list cleared.";
    recordLatestAccepted.textContent = "Waiting for a cut...";
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
    renderStockPreview();
  });

  unitSelect.addEventListener("change", (event) => {
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

  loadLocalState();
  hydrateInputs();
  setupRecognition();
  setupServiceWorker();
  updateModeUI();
  updateRecordingUI();
  renderCuts();
  renderResults();
  applyConfidence(Number.parseFloat(slider.value));
})();
