const assert = require("node:assert/strict");
const { evaluatePacking, evaluatePackingExact, parseMeasurement, parseStockInput } = require("./engine.js");

const approxEqual = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} ~= ${expected}`);
};

const shouldParse = (phrase, expectedInches, unit = "inches") => {
  const parsed = parseMeasurement(phrase, unit);
  assert.ok(parsed, `Expected parse success for: ${phrase}`);
  approxEqual(parsed.totalInches, expectedInches);
};

const shouldFail = (phrase, unit = "inches") => {
  const parsed = parseMeasurement(phrase, unit);
  assert.equal(parsed, null, `Expected parse failure for: ${phrase}`);
};

const testParser = () => {
  shouldParse("3 and a half feet", 42);
  shouldParse("3/16 in", 0.1875);
  shouldParse("2.5 m", (2.5 * 100) / 2.54);
  shouldParse("8", 96, "feet");

  // Unsupported denominator-word formats should safe-fail.
  shouldFail("12 13/64ths inches");
  shouldFail("13 64ths inches");
  shouldFail("64ths");

  shouldParse("12 13/64 inches", 12 + 13 / 64);

  const stocks = parseStockInput("8 ft, noise, 12 ft", "inches");
  assert.deepEqual(stocks, [96, 144]);
};

const testOptimizer = () => {
  const result = evaluatePacking([60, 60, 36], [96, 120], 0.125);
  assert.equal(result.binCount, 3);
  approxEqual(result.totalUsed, 156, 1e-6);
  approxEqual(result.totalWaste, 132, 1e-6);
  approxEqual(result.totalKerfLoss, 0, 1e-6);

  const kerfResult = evaluatePacking([40, 40, 40], [96], 0.125);
  assert.equal(kerfResult.binCount, 2);
  approxEqual(kerfResult.totalKerfLoss, 0.125, 1e-6);

  assert.throws(() => evaluatePacking([500], [96, 120], 0.125));
};

const testExactOptimizer = () => {
  const cuts = [52, 48, 48, 45, 36, 24, 24];
  const stocks = [96, 120];
  const kerf = 0.125;

  const heuristic = evaluatePacking(cuts, stocks, kerf);
  const exact = evaluatePackingExact(cuts, stocks, kerf, { timeBudgetMs: 3000 });

  assert.equal(exact.termination, "completed");
  assert.equal(exact.optimality, "proven_optimal");
  assert.ok(exact.exploredNodes > 0);

  const heuristicObjective = heuristic.totalStockLength + kerf * heuristic.binCount;
  const exactObjective = exact.totalStockLength + kerf * exact.binCount;
  assert.ok(exactObjective <= heuristicObjective + 1e-9, "Exact objective must be at least as good as heuristic");

  const timeoutCase = evaluatePackingExact(
    [84, 84, 84, 84, 72, 72, 72, 72, 66, 66, 66, 66, 60, 60, 60, 60, 54, 54, 54, 54],
    [96, 120, 144],
    kerf,
    { timeBudgetMs: 1 }
  );
  assert.ok(["timed_out", "completed"].includes(timeoutCase.termination));
};

testParser();
testOptimizer();
testExactOptimizer();

console.log("Regression tests passed.");
