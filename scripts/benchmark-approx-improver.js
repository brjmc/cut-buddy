#!/usr/bin/env node

const { evaluatePacking, evaluatePackingApprox } = require("./engine.js");

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
    samples: Math.max(1, Number.parseInt(args.get("samples") || "120", 10)),
    sizes: parseList(args.get("sizes"), [20, 40, 60, 100]),
    stock: parseList(args.get("stock"), [96, 120, 144]),
    minCut: Math.max(1, Number.parseInt(args.get("minCut") || "12", 10)),
    maxCut: Math.max(2, Number.parseInt(args.get("maxCut") || "96", 10)),
    kerf: Math.max(0, Number.parseFloat(args.get("kerf") || "0.125")),
    budget: Math.max(1, Number.parseInt(args.get("budget") || "2500", 10)),
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

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
};

const pct = (value) => `${(value * 100).toFixed(1)}%`;

const run = () => {
  const config = parseArgs();
  const rng = createSeededRandom(config.seed);

  console.log("Approximate Improver Benchmark");
  console.log(
    `samples=${config.samples}, budgetMs=${config.budget}, kerf=${config.kerf}, cutRange=[${config.minCut},${config.maxCut}], stock=[${config.stock.join(",")}]`
  );
  console.log("size,total,improved,improved_rate,mean_obj_lift,p95_obj_lift,timeout_rate,cancel_rate");

  config.sizes.forEach((size) => {
    let improved = 0;
    let timedOut = 0;
    let cancelled = 0;
    const lifts = [];

    for (let sample = 0; sample < config.samples; sample += 1) {
      const cuts = randomCuts(size, rng, config.minCut, config.maxCut);
      const heuristic = evaluatePacking(cuts, config.stock, config.kerf);
      const approx = evaluatePackingApprox(cuts, config.stock, config.kerf, {
        timeBudgetMs: config.budget,
        seed: config.seed + size * 1000 + sample,
        deterministic: true
      });

      if (approx.termination === "timed_out") {
        timedOut += 1;
      } else if (approx.termination === "cancelled") {
        cancelled += 1;
      }

      const heuristicObjective = objective(heuristic, config.kerf);
      const approxObjective = objective(approx, config.kerf);
      const lift = heuristicObjective > EPSILON ? (heuristicObjective - approxObjective) / heuristicObjective : 0;

      if (lift > EPSILON) {
        improved += 1;
        lifts.push(lift);
      }
    }

    const improvedRate = improved / config.samples;
    const timeoutRate = timedOut / config.samples;
    const cancelRate = cancelled / config.samples;
    const meanLift = lifts.length ? lifts.reduce((sum, value) => sum + value, 0) / lifts.length : 0;
    const p95Lift = percentile(lifts, 95);

    console.log(
      [
        size,
        config.samples,
        improved,
        pct(improvedRate),
        pct(meanLift),
        pct(p95Lift),
        pct(timeoutRate),
        pct(cancelRate)
      ].join(",")
    );
  });
};

run();
