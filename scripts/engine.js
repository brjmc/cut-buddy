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
  const DEFAULT_APPROX_TIME_BUDGET_MS = 2500;

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

  const objectiveOf = (result, kerf) => result.totalStockLength + kerf * result.binCount;

  const createSeededRandom = (seed = 1) => {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  };

  const normalizedStockLengths = (stockLengths) => {
    const normalized = [...new Set(stockLengths.filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
    if (!normalized.length) {
      throw new Error("No valid stock lengths available for optimization.");
    }
    return normalized;
  };

  const validateCutsFit = (cuts, stockLengths) => {
    const maxStock = stockLengths[stockLengths.length - 1];
    const invalid = cuts.find((cut) => cut - maxStock > EPSILON);
    if (invalid !== undefined) {
      throw new Error(`Cut ${invalid.toFixed(3)} in exceeds all configured stock lengths.`);
    }
  };

  const recomputeBinUsage = (bin, kerf) => {
    const cuts = bin.cuts.length;
    const totalCuts = bin.cuts.reduce((sum, value) => sum + value, 0);
    const used = totalCuts + Math.max(0, cuts - 1) * kerf;
    bin.used = roundTo(used, 6);
    bin.remaining = roundTo(bin.stockLength - used, 6);
  };

  const buildBin = (stockLength, cuts, kerf) => {
    const bin = {
      stockLength,
      cuts: [...cuts],
      used: 0,
      remaining: 0
    };
    recomputeBinUsage(bin, kerf);
    return bin;
  };

  const shuffle = (items, rng) => {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rng() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  };

  const randomizedCutOrder = (cuts, rng) => {
    const withNoise = cuts.map((cut) => ({
      cut,
      noise: (rng() - 0.5) * 2.5
    }));
    withNoise.sort((a, b) => b.cut - a.cut || b.noise - a.noise);

    for (let index = 0; index + 1 < withNoise.length; index += 1) {
      if (rng() < 0.2) {
        [withNoise[index], withNoise[index + 1]] = [withNoise[index + 1], withNoise[index]];
      }
    }

    return withNoise.map((entry) => entry.cut);
  };

  const chooseCandidate = (candidates, rng) => {
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.remainingAfter - b.remainingAfter || a.tie - b.tie);
    const topWindow = Math.min(candidates.length, 3);
    const pick = Math.floor(rng() * topWindow);
    return candidates[pick];
  };

  const packWithGuidedHeuristic = (cutOrder, stockLengths, kerf, rng, mode = "best_fit") => {
    const bins = [];

    for (let index = 0; index < cutOrder.length; index += 1) {
      const cutLength = cutOrder[index];
      const existingCandidates = [];

      for (let binIndex = 0; binIndex < bins.length; binIndex += 1) {
        const bin = bins[binIndex];
        const required = cutLength + (bin.cuts.length > 0 ? kerf : 0);
        const remainingAfter = bin.remaining - required;
        if (remainingAfter < -EPSILON) continue;
        existingCandidates.push({
          kind: "existing",
          index: binIndex,
          remainingAfter,
          required,
          tie: rng()
        });
      }

      const stockCandidates = [];
      for (let stockIndex = 0; stockIndex < stockLengths.length; stockIndex += 1) {
        const stockLength = stockLengths[stockIndex];
        const remainingAfter = stockLength - cutLength;
        if (remainingAfter < -EPSILON) continue;
        stockCandidates.push({
          kind: "new",
          stockLength,
          remainingAfter,
          required: cutLength,
          tie: rng()
        });
      }

      if (!stockCandidates.length && !existingCandidates.length) {
        throw new Error(`Cut ${cutLength.toFixed(3)} in exceeds all configured stock lengths.`);
      }

      const candidates = mode === "first_fit" ? [...existingCandidates, ...stockCandidates].reverse() : [...existingCandidates, ...stockCandidates];
      const selected = chooseCandidate(candidates, rng) || candidates[0];
      if (!selected) continue;

      if (selected.kind === "existing") {
        const target = bins[selected.index];
        target.cuts.push(cutLength);
        recomputeBinUsage(target, kerf);
      } else {
        bins.push(buildBin(selected.stockLength, [cutLength], kerf));
      }
    }

    return summarizeBins(bins, kerf);
  };

  const cleanupEmptyBins = (bins) => bins.filter((bin) => bin.cuts.length > 0);

  const tryRelocateMove = (solution, stockLengths, kerf, rng) => {
    if (!solution.bins.length) return null;
    const sourceOrder = shuffle(solution.bins.map((_bin, index) => index), rng);

    for (let sourcePos = 0; sourcePos < sourceOrder.length; sourcePos += 1) {
      const fromIndex = sourceOrder[sourcePos];
      const fromBin = solution.bins[fromIndex];
      if (!fromBin || !fromBin.cuts.length) continue;
      const cutOrder = shuffle(fromBin.cuts.map((_cut, cutIndex) => cutIndex), rng);

      for (let cutPos = 0; cutPos < cutOrder.length; cutPos += 1) {
        const cutIndex = cutOrder[cutPos];
        const cut = fromBin.cuts[cutIndex];
        const targetOrder = shuffle(solution.bins.map((_bin, index) => index).filter((idx) => idx !== fromIndex), rng);

        for (let targetPos = 0; targetPos < targetOrder.length; targetPos += 1) {
          const toIndex = targetOrder[targetPos];
          const bins = cloneBins(solution.bins);
          const from = bins[fromIndex];
          const to = bins[toIndex];
          from.cuts.splice(cutIndex, 1);
          recomputeBinUsage(from, kerf);
          to.cuts.push(cut);
          recomputeBinUsage(to, kerf);
          if (to.remaining < -EPSILON) continue;
          const normalized = cleanupEmptyBins(bins);
          return summarizeBins(normalized, kerf);
        }

        for (let stockIndex = 0; stockIndex < stockLengths.length; stockIndex += 1) {
          const stockLength = stockLengths[stockIndex];
          if (stockLength - cut < -EPSILON) continue;
          const bins = cloneBins(solution.bins);
          const from = bins[fromIndex];
          from.cuts.splice(cutIndex, 1);
          recomputeBinUsage(from, kerf);
          bins.push(buildBin(stockLength, [cut], kerf));
          const normalized = cleanupEmptyBins(bins);
          return summarizeBins(normalized, kerf);
        }
      }
    }

    return null;
  };

  const trySwapMove = (solution, kerf, rng) => {
    if (solution.bins.length < 2) return null;
    const pairs = [];
    for (let left = 0; left < solution.bins.length; left += 1) {
      for (let right = left + 1; right < solution.bins.length; right += 1) {
        pairs.push([left, right]);
      }
    }
    shuffle(pairs, rng);

    for (let pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
      const [leftIndex, rightIndex] = pairs[pairIndex];
      const leftBin = solution.bins[leftIndex];
      const rightBin = solution.bins[rightIndex];
      if (!leftBin.cuts.length || !rightBin.cuts.length) continue;
      const leftCuts = shuffle(leftBin.cuts.map((_cut, index) => index), rng);
      const rightCuts = shuffle(rightBin.cuts.map((_cut, index) => index), rng);

      for (let leftPos = 0; leftPos < leftCuts.length; leftPos += 1) {
        for (let rightPos = 0; rightPos < rightCuts.length; rightPos += 1) {
          const bins = cloneBins(solution.bins);
          const left = bins[leftIndex];
          const right = bins[rightIndex];
          const leftCut = left.cuts[leftCuts[leftPos]];
          const rightCut = right.cuts[rightCuts[rightPos]];
          left.cuts[leftCuts[leftPos]] = rightCut;
          right.cuts[rightCuts[rightPos]] = leftCut;
          recomputeBinUsage(left, kerf);
          recomputeBinUsage(right, kerf);
          if (left.remaining < -EPSILON || right.remaining < -EPSILON) continue;
          return summarizeBins(bins, kerf);
        }
      }
    }

    return null;
  };

  const tryEjectionChain = (solution, stockLengths, kerf, rng) => {
    if (solution.bins.length < 2) return null;
    const sourceOrder = shuffle(solution.bins.map((_bin, index) => index), rng);

    for (let sourcePos = 0; sourcePos < sourceOrder.length; sourcePos += 1) {
      const sourceIndex = sourceOrder[sourcePos];
      const sourceBin = solution.bins[sourceIndex];
      if (!sourceBin.cuts.length) continue;

      const sourceCutIndices = shuffle(sourceBin.cuts.map((_cut, index) => index), rng);
      for (let cutPos = 0; cutPos < sourceCutIndices.length; cutPos += 1) {
        const sourceCutIndex = sourceCutIndices[cutPos];
        const sourceCut = sourceBin.cuts[sourceCutIndex];
        const midOrder = shuffle(solution.bins.map((_bin, index) => index).filter((index) => index !== sourceIndex), rng);

        for (let midPos = 0; midPos < midOrder.length; midPos += 1) {
          const midIndex = midOrder[midPos];
          const midBin = solution.bins[midIndex];
          if (!midBin.cuts.length) continue;
          const midCutIndices = shuffle(midBin.cuts.map((_cut, index) => index), rng);

          for (let midCutPos = 0; midCutPos < midCutIndices.length; midCutPos += 1) {
            const midCutIndex = midCutIndices[midCutPos];
            const midCut = midBin.cuts[midCutIndex];
            const bins = cloneBins(solution.bins);
            const src = bins[sourceIndex];
            const mid = bins[midIndex];

            src.cuts.splice(sourceCutIndex, 1);
            recomputeBinUsage(src, kerf);
            mid.cuts[midCutIndex] = sourceCut;
            recomputeBinUsage(mid, kerf);
            if (mid.remaining < -EPSILON) continue;

            let inserted = false;
            const destinationOrder = shuffle(
              bins.map((_bin, index) => index).filter((index) => index !== sourceIndex && index !== midIndex),
              rng
            );

            for (let destPos = 0; destPos < destinationOrder.length; destPos += 1) {
              const dest = bins[destinationOrder[destPos]];
              dest.cuts.push(midCut);
              recomputeBinUsage(dest, kerf);
              if (dest.remaining >= -EPSILON) {
                inserted = true;
                break;
              }
              dest.cuts.pop();
              recomputeBinUsage(dest, kerf);
            }

            if (!inserted) {
              for (let stockIndex = 0; stockIndex < stockLengths.length; stockIndex += 1) {
                const stockLength = stockLengths[stockIndex];
                if (stockLength - midCut < -EPSILON) continue;
                bins.push(buildBin(stockLength, [midCut], kerf));
                inserted = true;
                break;
              }
            }

            if (!inserted) continue;
            const normalized = cleanupEmptyBins(bins);
            return summarizeBins(normalized, kerf);
          }
        }
      }
    }

    return null;
  };

  const tryLnsRepair = (solution, stockLengths, kerf, rng, maxDestroyedBins = 3) => {
    if (!solution.bins.length) return null;
    const destroyCount = Math.max(1, Math.min(maxDestroyedBins, solution.bins.length));
    const order = shuffle(solution.bins.map((_bin, index) => index), rng);
    const destroyed = new Set(order.slice(0, destroyCount));
    const keepBins = [];
    const removedCuts = [];

    for (let index = 0; index < solution.bins.length; index += 1) {
      const bin = solution.bins[index];
      if (destroyed.has(index)) {
        removedCuts.push(...bin.cuts);
      } else {
        keepBins.push({
          stockLength: bin.stockLength,
          cuts: [...bin.cuts],
          used: bin.used,
          remaining: bin.remaining
        });
      }
    }

    const sortedRemoved = randomizedCutOrder(removedCuts, rng);
    const mode = rng() < 0.5 ? "best_fit" : "first_fit";
    const repaired = packWithGuidedHeuristic(sortedRemoved, stockLengths, kerf, rng, mode);
    const merged = [...keepBins, ...cloneBins(repaired.bins)];
    return summarizeBins(merged, kerf);
  };

  const improveLocally = (candidate, stockLengths, kerf, rng, options) => {
    let best = {
      ...candidate,
      bins: cloneBins(candidate.bins)
    };

    const deadline = Number.isFinite(options.deadline) ? options.deadline : Number.POSITIVE_INFINITY;
    const shouldAbort = typeof options.shouldAbort === "function" ? options.shouldAbort : null;
    const maxLocalIterations = Math.max(1, Number(options.maxLocalIterations) || 40);
    for (let iteration = 0; iteration < maxLocalIterations; iteration += 1) {
      if (nowMs() > deadline) break;
      if (shouldAbort && shouldAbort()) break;
      let proposal = null;
      const roll = rng();
      if (roll < 0.45) {
        proposal = tryRelocateMove(best, stockLengths, kerf, rng);
      } else if (roll < 0.85) {
        proposal = trySwapMove(best, kerf, rng);
      } else {
        proposal = tryEjectionChain(best, stockLengths, kerf, rng);
      }

      if (proposal && compareSolutions(proposal, best, kerf) < 0) {
        best = {
          ...proposal,
          bins: cloneBins(proposal.bins)
        };
      }
    }

    const maxLnsIterations = Math.max(1, Number(options.maxLnsIterations) || 12);
    const lnsStateCap = Math.max(16, Number(options.lnsStateCap) || 128);
    const lnsSeen = new Set();

    for (let iteration = 0; iteration < maxLnsIterations; iteration += 1) {
      if (nowMs() > deadline) break;
      if (shouldAbort && shouldAbort()) break;
      const repaired = tryLnsRepair(best, stockLengths, kerf, rng, 3);
      if (!repaired) continue;
      const signature = repaired.bins
        .map((bin) => `${roundTo(bin.stockLength, 4)}:${roundTo(bin.remaining, 4)}:${bin.cuts.length}`)
        .sort()
        .join("|");
      if (lnsSeen.has(signature)) continue;
      lnsSeen.add(signature);
      if (lnsSeen.size > lnsStateCap) {
        const first = lnsSeen.values().next();
        if (!first.done) {
          lnsSeen.delete(first.value);
        }
      }

      if (compareSolutions(repaired, best, kerf) < 0) {
        best = {
          ...repaired,
          bins: cloneBins(repaired.bins)
        };
      }
    }

    return best;
  };

  const evaluatePackingApprox = (cutLengths, stockLengths, kerf, options = {}) => {
    const timeBudgetMs = Number.isFinite(options.timeBudgetMs)
      ? Math.max(1, Number(options.timeBudgetMs))
      : DEFAULT_APPROX_TIME_BUDGET_MS;
    const seed = Number.isFinite(options.seed) ? Number(options.seed) : Date.now();
    const shouldAbort = typeof options.shouldAbort === "function" ? options.shouldAbort : null;
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const onImprovement = typeof options.onImprovement === "function" ? options.onImprovement : null;
    const progressIntervalMs = Number.isFinite(options.progressIntervalMs) ? Math.max(50, Number(options.progressIntervalMs)) : 250;
    const maxIterations = Number.isFinite(options.maxIterations) ? Math.max(1, Number(options.maxIterations)) : 1000;
    const deterministic = Boolean(options.deterministic);
    const rng = createSeededRandom(deterministic ? seed : (seed ^ Date.now()) >>> 0);

    if (!Array.isArray(cutLengths) || !cutLengths.length) {
      const empty = summarizeBins([], kerf);
      return {
        ...empty,
        elapsedMs: 0,
        iterations: 0,
        improvements: 0,
        termination: "completed",
        optimality: "not_proven",
        seed
      };
    }

    const normalizedStocks = normalizedStockLengths(stockLengths);
    const cleanCuts = cutLengths.filter((value) => Number.isFinite(value) && value > 0);
    if (!cleanCuts.length) {
      throw new Error("No valid cuts available for optimization.");
    }
    validateCutsFit(cleanCuts, normalizedStocks);

    const start = nowMs();
    const deadline = start + timeBudgetMs;

    let bestSeed = evaluatePacking(cleanCuts, normalizedStocks, kerf);
    let best = {
      ...bestSeed,
      bins: cloneBins(bestSeed.bins)
    };
    let iterations = 0;
    let improvements = 0;
    let cancelled = false;
    let timedOut = false;
    let lastProgressAt = start;

    const emitProgress = () => {
      if (!onProgress) return;
      onProgress({
        elapsedMs: roundTo(nowMs() - start, 3),
        iterations,
        improvements,
        incumbentObjective: roundTo(objectiveOf(best, kerf), 6),
        incumbentBinCount: best.binCount,
        incumbentWaste: best.totalWaste
      });
    };

    emitProgress();

    while (iterations < maxIterations) {
      const loopNow = nowMs();
      if (loopNow > deadline) {
        timedOut = true;
        break;
      }
      if (shouldAbort && shouldAbort()) {
        cancelled = true;
        break;
      }

      const cutOrder = randomizedCutOrder(cleanCuts, rng);
      const mode = rng() < 0.75 ? "best_fit" : "first_fit";
      const seededCandidate = packWithGuidedHeuristic(cutOrder, normalizedStocks, kerf, rng, mode);
      const improvedCandidate = improveLocally(seededCandidate, normalizedStocks, kerf, rng, {
        deadline,
        shouldAbort,
        maxLocalIterations: options.maxLocalIterations,
        maxLnsIterations: options.maxLnsIterations,
        lnsStateCap: options.lnsStateCap
      });

      iterations += 1;
      if (compareSolutions(improvedCandidate, best, kerf) < 0) {
        best = {
          ...improvedCandidate,
          bins: cloneBins(improvedCandidate.bins)
        };
        improvements += 1;
        if (onImprovement) {
          onImprovement({
            candidate: {
              ...best,
              bins: cloneBins(best.bins)
            },
            elapsedMs: roundTo(nowMs() - start, 3),
            iterations,
            improvements,
            objective: roundTo(objectiveOf(best, kerf), 6)
          });
        }
      }

      const now = nowMs();
      if (now - lastProgressAt >= progressIntervalMs) {
        lastProgressAt = now;
        emitProgress();
      }
    }

    emitProgress();
    return {
      ...best,
      elapsedMs: roundTo(nowMs() - start, 3),
      iterations,
      improvements,
      termination: cancelled ? "cancelled" : timedOut ? "timed_out" : "completed",
      optimality: "not_proven",
      seed
    };
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
    evaluatePackingApprox,
    evaluatePackingExact,
    DEFAULT_EXACT_TIME_BUDGET_MS,
    DEFAULT_APPROX_TIME_BUDGET_MS
  };

  root.CutBuddyEngine = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
