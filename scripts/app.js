(() => {
  const screen = document.querySelector(".confidence-screen");
  const slider = document.getElementById("confidenceRange");
  const labelEl = document.getElementById("confidenceLabel");
  const scoreEl = document.getElementById("confidenceScore");
  const presetButtons = document.querySelectorAll(".pill[data-confidence]");
  const recordingStatus = document.getElementById("recordingStatus");
  const speechSupport = document.getElementById("speechSupport");
  const toggleListeningButton = document.getElementById("toggleListening");
  const clearCutsButton = document.getElementById("clearCuts");
  const phraseInput = document.getElementById("phraseInput");
  const addPhraseButton = document.getElementById("addPhrase");
  const liveTranscript = document.getElementById("liveTranscript");
  const cutsList = document.getElementById("cutsList");
  const cutsCount = document.getElementById("cutsCount");

  if (!screen || !slider || !labelEl || !scoreEl || !cutsList || !cutsCount || !liveTranscript) {
    return;
  }

  const CONFIDENCE_STATES = [
    {
      min: 0.75,
      label: "Clear interpretation",
      gradient: "linear-gradient(135deg, #b4d8ff, #7de4d1)",
      textColor: "#041520"
    },
    {
      min: 0.45,
      label: "Need a quick check",
      gradient: "linear-gradient(135deg, #ffd79a, #ffaa64)",
      textColor: "#3a1700"
    },
    {
      min: 0,
      label: "Help me fix this",
      gradient: "linear-gradient(135deg, #ff9f9f, #ff4f5e)",
      textColor: "#370003"
    }
  ];

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
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const cuts = [];
  let isListening = false;
  let shouldListen = false;
  let recognition = null;

  const clampConfidence = (value) => {
    if (Number.isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
  };

  const getState = (value) => {
    return CONFIDENCE_STATES.find((state) => value >= state.min) || CONFIDENCE_STATES[2];
  };

  const applyConfidence = (value) => {
    const confidence = clampConfidence(value);
    const state = getState(confidence);
    const percent = Math.round(confidence * 100);

    screen.style.setProperty("--confidence-color", state.gradient);
    screen.style.setProperty("color", state.textColor);
    labelEl.textContent = state.label;
    scoreEl.textContent = `${percent}%`;
    slider.value = confidence.toString();
    slider.setAttribute("aria-valuenow", confidence.toFixed(2));
    screen.setAttribute("aria-label", `${state.label} at ${percent} percent confidence`);
  };

  const setSupportText = (text, isError = false) => {
    if (!speechSupport) return;
    speechSupport.textContent = text;
    speechSupport.classList.toggle("is-error", isError);
  };

  const updateRecordingUI = () => {
    if (!recordingStatus || !toggleListeningButton) return;

    const active = shouldListen || isListening;
    recordingStatus.textContent = active ? "Recorder live" : "Recorder idle";
    toggleListeningButton.textContent = active ? "Stop recording" : "Start recording";
    toggleListeningButton.classList.toggle("is-live", active);

    if (!active && !liveTranscript.textContent.trim()) {
      liveTranscript.textContent = "Waiting for speech...";
    }
  };

  const tokenize = (text) => {
    return text
      .replace(/(\d)\s*'\s*/g, "$1 feet ")
      .replace(/(\d)\s*"\s*/g, "$1 inches ")
      .toLowerCase()
      .replace(/-/g, " ")
      .replace(/[^\w.\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  };

  const readAmount = (tokens, start) => {
    let index = start;
    let hasNumberContent = false;
    let current = 0;

    while (index < tokens.length) {
      const token = tokens[index];
      const numericToken = Number.parseFloat(token);

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

    if (!hasNumberContent) {
      return null;
    }

    return { value: current, nextIndex: index };
  };

  const parseMeasurement = (phrase) => {
    const tokens = tokenize(phrase);
    if (tokens.length === 0) return null;

    let feet = 0;
    let inches = 0;
    let cursor = 0;

    while (cursor < tokens.length) {
      const amount = readAmount(tokens, cursor);
      if (!amount) {
        cursor += 1;
        continue;
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

      inches += amount.value;
    }

    const totalInches = feet * 12 + inches;
    if (totalInches <= 0) return null;

    return {
      raw: phrase.trim(),
      feet,
      inches,
      totalInches,
      display: `${totalInches.toFixed(2).replace(/\.00$/, "")} in`
    };
  };

  const renderCuts = () => {
    cutsList.innerHTML = "";
    cuts.forEach((cut, index) => {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${cut.raw} -> ${cut.display}`;
      cutsList.appendChild(item);
    });
    cutsCount.textContent = `${cuts.length} ${cuts.length === 1 ? "item" : "items"}`;
  };

  const addCutFromPhrase = (sourceText = "") => {
    const phrase = sourceText.trim() || (phraseInput ? phraseInput.value.trim() : "");
    if (!phrase) return;

    const measurement = parseMeasurement(phrase);
    liveTranscript.textContent = phrase;

    if (!measurement) {
      liveTranscript.textContent = `Could not parse: "${phrase}"`;
      applyConfidence(0.2);
      return;
    }

    cuts.push(measurement);
    renderCuts();
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
    shouldListen = false;
    if (recognition && isListening) {
      recognition.stop();
    }
    isListening = false;
    updateRecordingUI();
  };

  const startListening = () => {
    if (!recognition) {
      setSupportText("SpeechRecognition is not supported in this browser.", true);
      return;
    }

    shouldListen = true;
    liveTranscript.textContent = "Listening for length phrases...";

    try {
      recognition.start();
    } catch (_error) {
      // Some engines throw if start is called while already active.
    }
    updateRecordingUI();
  };

  const setupRecognition = () => {
    if (!SpeechRecognition) {
      setSupportText("SpeechRecognition is not supported in this browser.", true);
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    setSupportText("Speech recognition ready. Tap Start recording and grant mic permission.");

    recognition.onstart = () => {
      isListening = true;
      updateRecordingUI();
    };

    recognition.onresult = (event) => {
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const best = result[0];
        if (!best) continue;

        const confidence = clampConfidence(best.confidence);
        if (confidence > 0) {
          applyConfidence(confidence);
        }

        if (result.isFinal) {
          const finalText = best.transcript.trim();
          if (finalText) {
            liveTranscript.textContent = finalText;
            addCutFromPhrase(finalText);
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

    recognition.onerror = (event) => {
      const errorMessage = mapSpeechError(event.error);
      setSupportText(errorMessage, true);
      liveTranscript.textContent = errorMessage;

      if (event.error === "not-allowed" || event.error === "audio-capture") {
        shouldListen = false;
      }
    };

    recognition.onend = () => {
      isListening = false;
      if (shouldListen) {
        try {
          recognition.start();
          return;
        } catch (_error) {
          // If immediate restart fails, UI will remain idle until next user action.
        }
      }
      updateRecordingUI();
    };
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

  if (toggleListeningButton) {
    toggleListeningButton.addEventListener("click", () => {
      if (shouldListen || isListening) {
        stopListening();
      } else {
        startListening();
      }
    });
  }

  if (clearCutsButton) {
    clearCutsButton.addEventListener("click", () => {
      cuts.length = 0;
      renderCuts();
      liveTranscript.textContent = "Cut list cleared.";
    });
  }

  if (addPhraseButton) {
    addPhraseButton.addEventListener("click", () => {
      addCutFromPhrase();
    });
  }

  if (phraseInput) {
    phraseInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addCutFromPhrase();
      }
    });
  }

  setupRecognition();
  updateRecordingUI();
  renderCuts();
  applyConfidence(Number.parseFloat(slider.value));
})();
