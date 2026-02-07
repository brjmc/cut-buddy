(function initCutBuddyEngine(root) {
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

  const FRACTION_WORD_TOKENS = new Set([
    "halves",
    "third",
    "thirds",
    "fourth",
    "fourths",
    "fifth",
    "fifths",
    "sixth",
    "sixths",
    "seventh",
    "sevenths",
    "eighth",
    "eighths",
    "ninth",
    "ninths",
    "tenth",
    "tenths",
    "eleventh",
    "elevenths",
    "twelfth",
    "twelfths",
    "thirteenth",
    "thirteenths",
    "fourteenth",
    "fourteenths",
    "fifteenth",
    "fifteenths",
    "sixteenth",
    "sixteenths",
    "seventeenth",
    "seventeenths",
    "eighteenth",
    "eighteenths",
    "nineteenth",
    "nineteenths",
    "twentieth",
    "twentieths",
    "thirtieth",
    "thirtieths",
    "thirtysecond",
    "thirtyseconds",
    "sixtyfourth",
    "sixtyfourths"
  ]);

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
    const match = token.match(/^(\d+)\/(\d+)$/);
    if (!match) return null;

    const numerator = Number.parseInt(match[1], 10);
    const denominator = Number.parseInt(match[2], 10);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }

    return numerator / denominator;
  };

  const parseNumericTokenStrict = (token) => {
    if (!/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(token)) return null;
    const value = Number.parseFloat(token);
    return Number.isFinite(value) ? value : null;
  };

  const isUnsupportedFractionToken = (token) => {
    if (/^\d+[a-z]+$/i.test(token)) {
      return true;
    }

    if (FRACTION_WORD_TOKENS.has(token)) {
      return true;
    }

    return false;
  };

  const readAmount = (tokens, start) => {
    let index = start;
    let hasNumberContent = false;
    let current = 0;

    while (index < tokens.length) {
      const token = tokens[index];
      const fractionToken = parseFractionToken(token);
      const numericToken = parseNumericTokenStrict(token);

      if (fractionToken !== null) {
        current += fractionToken;
        hasNumberContent = true;
        index += 1;
        continue;
      }

      if (token.includes("/")) {
        return { invalidFractionToken: true, nextIndex: index };
      }

      if (numericToken !== null) {
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

      if (isUnsupportedFractionToken(token)) {
        return { invalidFractionToken: true, nextIndex: index };
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

  const toInchesFromDefaultUnit = (value, defaultUnit) => {
    if (defaultUnit === "feet") return value * 12;
    if (defaultUnit === "cm") return value / 2.54;
    if (defaultUnit === "mm") return value / 25.4;
    return value;
  };

  const parseMeasurement = (phrase, defaultUnit = "inches") => {
    const tokens = tokenize(phrase);
    if (!tokens.length) return null;

    let feet = 0;
    let inches = 0;
    let cursor = 0;

    while (cursor < tokens.length) {
      const amount = readAmount(tokens, cursor);
      if (!amount) {
        if (isUnsupportedFractionToken(tokens[cursor] || "")) return null;
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

      inches += toInchesFromDefaultUnit(amount.value, defaultUnit);
    }

    const totalInches = feet * 12 + inches;
    if (totalInches <= 0) return null;

    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      raw: phrase.trim(),
      totalInches
    };
  };

  const parseStockInput = (text, defaultUnit = "inches") => {
    return text
      .split(",")
      .map((segment) => parseMeasurement(segment.trim(), defaultUnit))
      .filter(Boolean)
      .map((entry) => entry.totalInches)
      .sort((a, b) => a - b);
  };

  const EPSILON = 1e-9;
  const DEFAULT_EXACT_TIME_BUDGET_MS = 3000;

  const nowMs = () => {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  };

  const roundTo = (value, digits = 6) => Number.parseFloat(value.toFixed(digits));

  const summarizeBins = (bins, kerf) => {
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
      totalUsed: roundTo(totalUsed, 3),
      totalWaste: roundTo(totalWaste, 3),
      totalStockLength: roundTo(totalStockLength, 3),
      totalKerfLoss: roundTo(totalKerfLoss, 3),
      utilization: roundTo(utilization, 6)
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
        throw new Error(`Cut ${cutLength.toFixed(3)} in exceeds all configured stock lengths.`);
      }

      if (best.kind === "existing") {
        const target = bins[best.index];
        target.cuts.push(cutLength);
        target.used += cutLength + best.extraKerf;
        target.remaining = roundTo(target.stockLength - target.used, 6);
      } else {
        bins.push({
          stockLength: best.stockLength,
          cuts: [cutLength],
          used: cutLength,
          remaining: roundTo(best.stockLength - cutLength, 6)
        });
      }
    });

    return summarizeBins(bins, kerf);
  };

  const cloneBins = (bins) => {
    return bins.map((bin) => ({
      stockLength: bin.stockLength,
      cuts: [...bin.cuts],
      used: bin.used,
      remaining: bin.remaining
    }));
  };

  const compareSolutions = (left, right, kerf) => {
    if (!right) return -1;

    const leftObjective = left.totalStockLength + kerf * left.binCount;
    const rightObjective = right.totalStockLength + kerf * right.binCount;
    if (leftObjective < rightObjective - EPSILON) return -1;
    if (leftObjective > rightObjective + EPSILON) return 1;

    if (left.totalWaste < right.totalWaste - EPSILON) return -1;
    if (left.totalWaste > right.totalWaste + EPSILON) return 1;

    if (left.binCount < right.binCount) return -1;
    if (left.binCount > right.binCount) return 1;

    return 0;
  };

  const evaluatePackingExact = (cutLengths, stockLengths, kerf, options = {}) => {
    const timeBudgetMs = Number.isFinite(options.timeBudgetMs)
      ? Math.max(1, Number(options.timeBudgetMs))
      : DEFAULT_EXACT_TIME_BUDGET_MS;
    const shouldAbort = typeof options.shouldAbort === "function" ? options.shouldAbort : null;

    if (!Array.isArray(cutLengths) || !cutLengths.length) {
      const empty = summarizeBins([], kerf);
      return {
        ...empty,
        exploredNodes: 0,
        elapsedMs: 0,
        termination: "completed",
        optimality: "proven_optimal"
      };
    }

    const sortedCuts = [...cutLengths].sort((a, b) => b - a);
    const sortedStockLengths = [...new Set(stockLengths.filter((value) => Number.isFinite(value) && value > 0))].sort(
      (a, b) => a - b
    );
    if (!sortedStockLengths.length) {
      throw new Error("No valid stock lengths available for exact optimization.");
    }

    const maxStock = sortedStockLengths[sortedStockLengths.length - 1];
    if (sortedCuts.some((cut) => cut - maxStock > EPSILON)) {
      const firstInvalid = sortedCuts.find((cut) => cut - maxStock > EPSILON);
      throw new Error(`Cut ${firstInvalid.toFixed(3)} in exceeds all configured stock lengths.`);
    }

    const start = nowMs();
    const deadline = start + timeBudgetMs;
    let exploredNodes = 0;
    let timedOut = false;
    let cancelled = false;

    const remainingTotals = new Array(sortedCuts.length + 1).fill(0);
    for (let index = sortedCuts.length - 1; index >= 0; index -= 1) {
      remainingTotals[index] = remainingTotals[index + 1] + sortedCuts[index];
    }

    const heuristicSeed = evaluatePacking(sortedCuts, sortedStockLengths, kerf);
    let best = {
      ...heuristicSeed,
      bins: cloneBins(heuristicSeed.bins)
    };

    const seenStates = new Map();

    const recursion = (index, bins, currentStockLength) => {
      exploredNodes += 1;
      if ((exploredNodes & 255) === 0 && nowMs() > deadline) {
        timedOut = true;
        return;
      }
      if ((exploredNodes & 127) === 0 && shouldAbort && shouldAbort()) {
        cancelled = true;
        return;
      }
      if (timedOut) return;
      if (cancelled) return;

      const currentBinCount = bins.length;
      const currentObjective = currentStockLength + kerf * currentBinCount;
      const freeInOpenBins = bins.reduce((sum, bin) => sum + Math.max(0, bin.remaining), 0);
      const requiredExtra = Math.max(0, remainingTotals[index] - freeInOpenBins);
      const minNewBins = Math.max(0, Math.ceil((requiredExtra - EPSILON) / maxStock));
      const optimisticObjective = currentStockLength + requiredExtra + kerf * (currentBinCount + minNewBins);
      const bestObjective = best.totalStockLength + kerf * best.binCount;
      if (optimisticObjective > bestObjective + EPSILON) {
        return;
      }

      const stateKey =
        index === sortedCuts.length
          ? `${index}|done`
          : `${index}|${bins
              .map((bin) => `${roundTo(bin.stockLength, 4)}:${roundTo(bin.remaining, 4)}`)
              .sort()
              .join("|")}`;
      const seenObjective = seenStates.get(stateKey);
      if (seenObjective !== undefined && seenObjective <= currentObjective + EPSILON) {
        return;
      }
      seenStates.set(stateKey, currentObjective);

      if (index >= sortedCuts.length) {
        const candidate = summarizeBins(cloneBins(bins), kerf);
        if (compareSolutions(candidate, best, kerf) < 0) {
          best = candidate;
        }
        return;
      }

      const cut = sortedCuts[index];
      const seenBinPlacements = new Set();

      for (let binIndex = 0; binIndex < bins.length; binIndex += 1) {
        const target = bins[binIndex];
        const extraKerf = target.cuts.length === 0 ? 0 : kerf;
        const required = cut + extraKerf;
        if (target.remaining - required < -EPSILON) {
          continue;
        }

        const nextRemaining = roundTo(target.remaining - required, 6);
        const signature = `${roundTo(target.stockLength, 4)}:${roundTo(nextRemaining, 4)}`;
        if (seenBinPlacements.has(signature)) {
          continue;
        }
        seenBinPlacements.add(signature);

        target.cuts.push(cut);
        target.used = roundTo(target.used + required, 6);
        target.remaining = nextRemaining;

        recursion(index + 1, bins, currentStockLength);

        target.cuts.pop();
        target.used = roundTo(target.used - required, 6);
        target.remaining = roundTo(target.remaining + required, 6);
      }

      for (let stockIndex = 0; stockIndex < sortedStockLengths.length; stockIndex += 1) {
        const stockLength = sortedStockLengths[stockIndex];
        if (stockLength - cut < -EPSILON) {
          continue;
        }

        bins.push({
          stockLength,
          cuts: [cut],
          used: cut,
          remaining: roundTo(stockLength - cut, 6)
        });

        recursion(index + 1, bins, currentStockLength + stockLength);

        bins.pop();
      }
    };

    recursion(0, [], 0);

    return {
      ...best,
      exploredNodes,
      elapsedMs: roundTo(nowMs() - start, 3),
      termination: cancelled ? "cancelled" : timedOut ? "timed_out" : "completed",
      optimality: cancelled || timedOut ? "not_proven" : "proven_optimal"
    };
  };

  const api = {
    parseMeasurement,
    parseStockInput,
    evaluatePacking,
    evaluatePackingExact,
    DEFAULT_EXACT_TIME_BUDGET_MS
  };

  root.CutBuddyEngine = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
