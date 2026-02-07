#!/usr/bin/env node

const { evaluatePacking, evaluatePackingExact } = require("./engine.js");

const EPSILON = 1e-6;

const parseArgs = () => {
  const args = new Map();
  process.argv.slice(2).forEach((entry) => {
    const [key, value] = entry.split("=");
    if (!key.startsWith("--")) return;
    args.set(key.slice(2), value === undefined ? "true" : value);
  });

  const parseList = (text, fallback) => {
    if (!text) return fallback;
    return text
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value) && value > 0);
  };

  return {
    samples: Math.max(1, Number.parseInt(args.get("samples") || "200", 10)),
    budget: Math.max(1, Number.parseInt(args.get("budget") || "1200", 10)),
    kerf: Math.max(0, Number.parseFloat(args.get("kerf") || "0.125")),
    minCut: Math.max(1, Number.parseInt(args.get("minCut") || "12", 10)),
    maxCut: Math.max(2, Number.parseInt(args.get("maxCut") || "96", 10)),
    sizes: parseList(args.get("sizes"), [8, 12, 16, 20]),
    stock: parseList(args.get("stock"), [96, 120, 144]),
    seed: Number.parseInt(args.get("seed") || "20260207", 10)
  };
};

const createSeededRandom = (seed = 42) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const randomCuts = (count, rng, minCut, maxCut) => {
  const span = Math.max(1, maxCut - minCut);
  const cuts = [];
  for (let index = 0; index < count; index += 1) {
    cuts.push(minCut + Math.round(rng() * span));
  }
  return cuts;
};

const objective = (result, kerf) => result.totalStockLength + kerf * result.binCount;

const pct = (value) => `${(value * 100).toFixed(1)}%`;

const run = () => {
  const config = parseArgs();
  const rng = createSeededRandom(config.seed);

  console.log("Heuristic vs Exact Quality Comparison");
  console.log(
    `samples=${config.samples}, budgetMs=${config.budget}, kerf=${config.kerf}, cutRange=[${config.minCut},${config.maxCut}], stock=[${config.stock.join(
      ","
    )}]`
  );
  console.log(
    "size,total,exact_completed,exact_timed_out,exact_cancelled,improved,equal,worse,improved_rate,avg_obj_improvement_pct,p95_obj_improvement_pct,avg_waste_improvement,in_bin_count_improved"
  );

  const totals = {
    total: 0,
    completed: 0,
    timedOut: 0,
    cancelled: 0,
    improved: 0,
    equal: 0,
    worse: 0,
    binCountImproved: 0,
    objectiveImprovementsPct: [],
    wasteImprovements: []
  };

  config.sizes.forEach((size) => {
    let completed = 0;
    let timedOut = 0;
    let cancelled = 0;
    let improved = 0;
    let equal = 0;
    let worse = 0;
    let binCountImproved = 0;

    const objectiveImprovementsPct = [];
    const wasteImprovements = [];

    for (let sampleIndex = 0; sampleIndex < config.samples; sampleIndex += 1) {
      const cuts = randomCuts(size, rng, config.minCut, config.maxCut);
      const heuristic = evaluatePacking(cuts, config.stock, config.kerf);
      const exact = evaluatePackingExact(cuts, config.stock, config.kerf, {
        timeBudgetMs: config.budget
      });

      if (exact.termination === "timed_out") {
        timedOut += 1;
        continue;
      }
      if (exact.termination === "cancelled") {
        cancelled += 1;
        continue;
      }
      if (exact.termination !== "completed") {
        continue;
      }

      completed += 1;
      const heuristicObjective = objective(heuristic, config.kerf);
      const exactObjective = objective(exact, config.kerf);
      const objectiveDelta = heuristicObjective - exactObjective;
      const wasteDelta = heuristic.totalWaste - exact.totalWaste;
      const objectiveImprovementPct = heuristicObjective > EPSILON ? objectiveDelta / heuristicObjective : 0;

      if (objectiveDelta > EPSILON) {
        improved += 1;
        objectiveImprovementsPct.push(objectiveImprovementPct);
        wasteImprovements.push(wasteDelta);
        if (exact.binCount < heuristic.binCount) {
          binCountImproved += 1;
        }
      } else if (objectiveDelta < -EPSILON) {
        worse += 1;
      } else {
        equal += 1;
      }
    }

    const sortedImprovementPct = [...objectiveImprovementsPct].sort((a, b) => a - b);
    const p95Index = sortedImprovementPct.length
      ? Math.min(sortedImprovementPct.length - 1, Math.ceil(sortedImprovementPct.length * 0.95) - 1)
      : -1;
    const p95Improvement = p95Index >= 0 ? sortedImprovementPct[p95Index] : 0;
    const avgImprovement =
      objectiveImprovementsPct.length > 0
        ? objectiveImprovementsPct.reduce((sum, value) => sum + value, 0) / objectiveImprovementsPct.length
        : 0;
    const avgWasteImprovement =
      wasteImprovements.length > 0 ? wasteImprovements.reduce((sum, value) => sum + value, 0) / wasteImprovements.length : 0;
    const improvedRate = completed > 0 ? improved / completed : 0;

    totals.total += config.samples;
    totals.completed += completed;
    totals.timedOut += timedOut;
    totals.cancelled += cancelled;
    totals.improved += improved;
    totals.equal += equal;
    totals.worse += worse;
    totals.binCountImproved += binCountImproved;
    totals.objectiveImprovementsPct.push(...objectiveImprovementsPct);
    totals.wasteImprovements.push(...wasteImprovements);

    console.log(
      [
        size,
        config.samples,
        completed,
        timedOut,
        cancelled,
        improved,
        equal,
        worse,
        pct(improvedRate),
        pct(avgImprovement),
        pct(p95Improvement),
        avgWasteImprovement.toFixed(3),
        binCountImproved
      ].join(",")
    );
  });

  const sortedOverallPct = [...totals.objectiveImprovementsPct].sort((a, b) => a - b);
  const overallP95Index = sortedOverallPct.length
    ? Math.min(sortedOverallPct.length - 1, Math.ceil(sortedOverallPct.length * 0.95) - 1)
    : -1;
  const overallP95 = overallP95Index >= 0 ? sortedOverallPct[overallP95Index] : 0;
  const overallAvgPct =
    totals.objectiveImprovementsPct.length > 0
      ? totals.objectiveImprovementsPct.reduce((sum, value) => sum + value, 0) / totals.objectiveImprovementsPct.length
      : 0;
  const overallAvgWaste =
    totals.wasteImprovements.length > 0
      ? totals.wasteImprovements.reduce((sum, value) => sum + value, 0) / totals.wasteImprovements.length
      : 0;
  const overallImprovedRate = totals.completed > 0 ? totals.improved / totals.completed : 0;

  console.log(
    [
      "overall",
      totals.total,
      totals.completed,
      totals.timedOut,
      totals.cancelled,
      totals.improved,
      totals.equal,
      totals.worse,
      pct(overallImprovedRate),
      pct(overallAvgPct),
      pct(overallP95),
      overallAvgWaste.toFixed(3),
      totals.binCountImproved
    ].join(",")
  );
};

run();
