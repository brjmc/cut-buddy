const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appPath = path.join(__dirname, "app.js");
const appSource = fs.readFileSync(appPath, "utf8");

const mustContain = (snippet, label) => {
  assert.ok(appSource.includes(snippet), `Missing workflow behavior: ${label}`);
};

// Record/plan mode flow hooks.
mustContain('const setMode = (mode) => {', "setMode function");
mustContain('const enterRecordMode = () => {', "enterRecordMode function");
mustContain('setMode("record");', "record mode activation");
mustContain('const exitRecordMode = () => {', "exitRecordMode function");
mustContain('setMode("plan");', "plan mode activation");
mustContain("scrollToResultsAfterRecordExit();", "record exit results scroll");

// Parse failure feedback must be explicit.
mustContain('liveTranscript.textContent = `Could not parse: \\"${phrase}\\"`;', "parse failure transcript");
mustContain('setSupportText(`Could not parse: "${phrase}"`, true);', "parse failure support feedback");
mustContain("showCorrectionPanel(phrase);", "parse failure correction panel trigger");
mustContain('const addCorrectedCut = (phrase, shouldSpeak = false) => {', "manual correction handler");
mustContain('applyCorrectionButton.addEventListener("click"', "manual correction button wiring");

// Record stop button wiring.
mustContain('recordToggleListeningButton.addEventListener("click"', "record toggle wiring");
mustContain("exitRecordMode();", "stop recording path");

// Planning calculation still available from plan mode.
mustContain('calculatePlanButton.addEventListener("click"', "calculate button wiring");
mustContain("runOptimization();", "optimization call");

console.log("Workflow precheck passed.");
