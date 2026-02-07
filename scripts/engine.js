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

  const api = {
    parseMeasurement,
    parseStockInput,
    evaluatePacking
  };

  root.CutBuddyEngine = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
