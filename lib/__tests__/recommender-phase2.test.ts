/**
 * Verification tests for lib/recommender.ts — Phase 2 (Method 3: convolution, beam search, Pareto).
 * Run: npx tsx lib/__tests__/recommender-phase2.test.ts
 */

import {
  type GameData,
  type Bundle,
  resAndCap,
  gamePmf,
  convolveNaive,
  convolveFFT,
  convolveCap,
  selfConvolve,
  probReachG,
  computeCoverage,
  pareto,
  floorSelect,
  recommend,
  createBundle,
  addToBundle,
} from "../recommender";

// ─── Test helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`);
  }
}

function assertClose(actual: number, expected: number, label: string, tol = 1e-6) {
  const ok = Math.abs(actual - expected) < tol;
  if (ok) {
    passed++;
    console.log(`  ✓ ${label} (${actual.toFixed(8)})`);
  } else {
    failed++;
    console.log(`  ✗ ${label}: expected ${expected.toFixed(8)}, got ${actual.toFixed(8)}`);
  }
}

// ─── Synthetic game data ────────────────────────────────────────────────────

// Simple game for convolution tests: $5 ticket, two prize tiers
// Net profits: $10-$5=$5, $50-$5=$45. 30% and 10% respectively.
const simpleGame: GameData = {
  gameId: 1,
  gameName: "Simple",
  gameNumber: "001",
  price: 5,
  imageUrl: null,
  tiers: [
    { prizeValue: 10, remaining: 300 },
    { prizeValue: 50, remaining: 100 },
  ],
  totalRemaining: 1000,
};

// Coin-flip game: price=$1, prize=$2 (net=$1). 50% chance of net $1.
const coinGame: GameData = {
  gameId: 10,
  gameName: "Coin",
  gameNumber: "010",
  price: 1,
  imageUrl: null,
  tiers: [{ prizeValue: 2, remaining: 500 }],
  totalRemaining: 1000,
};

// Games for integration tests
const gameX: GameData = {
  gameId: 100,
  gameName: "GameX",
  gameNumber: "100",
  price: 5,
  imageUrl: null,
  tiers: [
    { prizeValue: 10, remaining: 200 },
    { prizeValue: 25, remaining: 100 },
    { prizeValue: 50, remaining: 50 },
    { prizeValue: 100, remaining: 20 },
  ],
  totalRemaining: 1000,
};

const gameY: GameData = {
  gameId: 101,
  gameName: "GameY",
  gameNumber: "101",
  price: 10,
  imageUrl: null,
  tiers: [
    { prizeValue: 20, remaining: 250 },
    { prizeValue: 50, remaining: 100 },
    { prizeValue: 200, remaining: 30 },
  ],
  totalRemaining: 1000,
};

const gameZ: GameData = {
  gameId: 102,
  gameName: "GameZ",
  gameNumber: "102",
  price: 2,
  imageUrl: null,
  tiers: [
    { prizeValue: 5, remaining: 400 },
    { prizeValue: 10, remaining: 100 },
  ],
  totalRemaining: 1000,
};

// ═══════════════════════════════════════════════════════════════════════════
// Phase 2a: Convolution Evaluator
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== 2a: Adaptive Resolution ===");

const rc50 = resAndCap(50);
assert(rc50.res === 1, "goal=$50 → res=1");
assert(rc50.cap === 50, "goal=$50 → cap=50");

const rc100k = resAndCap(100000);
assert(rc100k.res === 50, "goal=$100K → res=50");
assert(rc100k.cap === 2000, "goal=$100K → cap=2000");

const rc2000 = resAndCap(2000);
assert(rc2000.res === 1, "goal=$2000 → res=1 (at MAX_BUCKETS boundary)");
assert(rc2000.cap === 2000, "goal=$2000 → cap=2000");

// ─── PMF tests ──────────────────────────────────────────────────────────────

console.log("\n=== 2a: PMF ===");

// Coin game: price=$1, prize=$2 (net=$1). 50% win net $1, 50% lose. res=1, cap=2
const coinPmf = gamePmf(coinGame, 1, 2);
assertClose(coinPmf[0], 0.5, "coin PMF[0] (lose) = 0.5");
assertClose(coinPmf[1], 0.5, "coin PMF[1] (net $1) = 0.5");
assertClose(coinPmf[2], 0.0, "coin PMF[2] = 0.0");

// PMF sums to 1
const coinSum = Array.from(coinPmf).reduce((s, v) => s + v, 0);
assertClose(coinSum, 1.0, "coin PMF sums to 1.0");

// Simple game (price=$5): nets = $5 (30%), $45 (10%), loss (60%). res=1, cap=100
const simplePmf = gamePmf(simpleGame, 1, 100);
assertClose(simplePmf[0], 0.6, "simple PMF[0] (lose) = 0.6");
assertClose(simplePmf[5], 0.3, "simple PMF[5] (net $5) = 0.3");
assertClose(simplePmf[45], 0.1, "simple PMF[45] (net $45) = 0.1");
const simpleSum = Array.from(simplePmf).reduce((s, v) => s + v, 0);
assertClose(simpleSum, 1.0, "simple PMF sums to 1.0");

// ─── Convolution correctness ────────────────────────────────────────────────

console.log("\n=== 2a: Naive Convolution ===");

// Two fair coins: P(0)=0.25, P(1)=0.5, P(2)=0.25
const twoCoins = convolveNaive(coinPmf, coinPmf, 2);
assertClose(twoCoins[0], 0.25, "2 coins: P($0) = 0.25");
assertClose(twoCoins[1], 0.50, "2 coins: P($1) = 0.50");
assertClose(twoCoins[2], 0.25, "2 coins: P($2) = 0.25");

// ─── FFT cross-validation ───────────────────────────────────────────────────

console.log("\n=== 2a: FFT Cross-Validation ===");

// Compare FFT vs naive on the simple game PMF convolved with itself
const naiveResult = convolveNaive(simplePmf, simplePmf, 100);
const fftResult = convolveFFT(simplePmf, simplePmf, 100);

let maxDiff = 0;
for (let i = 0; i <= 100; i++) {
  maxDiff = Math.max(maxDiff, Math.abs(naiveResult[i] - fftResult[i]));
}
assert(maxDiff < 1e-10, `FFT matches naive within 1e-10 (max diff: ${maxDiff.toExponential(2)})`);

// FFT sums to 1
const fftSum = Array.from(fftResult).reduce((s, v) => s + v, 0);
assertClose(fftSum, 1.0, "FFT result sums to 1.0", 1e-10);

// ─── Self-convolution ───────────────────────────────────────────────────────

console.log("\n=== 2a: Self-Convolution ===");

// n=1: should return original PMF
const self1 = selfConvolve(coinPmf, 1, 2);
assertClose(self1[0], 0.5, "selfConvolve n=1: PMF[0] = 0.5");
assertClose(self1[1], 0.5, "selfConvolve n=1: PMF[1] = 0.5");

// n=2: should match manual double convolution
const self2 = selfConvolve(coinPmf, 2, 2);
assertClose(self2[0], 0.25, "selfConvolve n=2: P($0) = 0.25");
assertClose(self2[1], 0.50, "selfConvolve n=2: P($1) = 0.50");
assertClose(self2[2], 0.25, "selfConvolve n=2: P($2) = 0.25");

// n=3: three coins, P(0)=0.125, P(1)=0.375, P(2)=0.375, P(3) folds into cap=2
// P(2) should absorb P(3): P(≥2) = P(2) + P(3) = 0.375 + 0.125 = 0.5
const self3 = selfConvolve(coinPmf, 3, 2);
assertClose(self3[0], 0.125, "selfConvolve n=3: P($0) = 0.125");
assertClose(self3[1], 0.375, "selfConvolve n=3: P($1) = 0.375");
assertClose(self3[2], 0.500, "selfConvolve n=3: P(≥$2) = 0.5 (absorbing bucket)");

// ─── Absorbing bucket test ──────────────────────────────────────────────────

console.log("\n=== 2a: Absorbing Bucket ===");

// Game with $30 prize, price=$5, net=$25. goal=$40, res=1, cap=40
// 2 tickets: net outcomes $0, $25, $50. $50 folds into cap=40 bucket.
const game30: GameData = {
  gameId: 20,
  gameName: "G30",
  gameNumber: "020",
  price: 5,
  imageUrl: null,
  tiers: [{ prizeValue: 30, remaining: 200 }],
  totalRemaining: 1000,
};
const pmf30 = gamePmf(game30, 1, 40);
assertClose(pmf30[0], 0.8, "G30 PMF[0] = 0.8");
assertClose(pmf30[25], 0.2, "G30 PMF[25] (net $25) = 0.2");

const two30 = selfConvolve(pmf30, 2, 40);
// P(net $0) = 0.8*0.8 = 0.64
// P(net $25) = 2*0.8*0.2 = 0.32
// P(net $50 → cap=40) = 0.2*0.2 = 0.04
assertClose(two30[0], 0.64, "2 tickets G30: P(net $0) = 0.64");
assertClose(two30[25], 0.32, "2 tickets G30: P(net $25) = 0.32");
assertClose(two30[40], 0.04, "2 tickets G30: P(net ≥$40) = 0.04 (absorbed from $50)");

// ═══════════════════════════════════════════════════════════════════════════
// Phase 2b: Beam Search, Pareto, Floor Selection
// ═══════════════════════════════════════════════════════════════════════════

// ─── Pareto frontier ────────────────────────────────────────────────────────

console.log("\n=== 2b: Pareto Frontier ===");

const bundles: Bundle[] = [
  { qty: new Map(), cost: 0, A: 0.9, B: 0.1 },
  { qty: new Map(), cost: 0, A: 0.7, B: 0.3 },
  { qty: new Map(), cost: 0, A: 0.5, B: 0.5 },
  { qty: new Map(), cost: 0, A: 0.3, B: 0.6 },
  { qty: new Map(), cost: 0, A: 0.1, B: 0.7 },
];
const front = pareto(bundles);
// All 5 are non-dominated (each trades A for B monotonically)
assert(front.length === 5, `Pareto frontier has 5 points (got ${front.length})`);

// Add a dominated point: A=0.4, B=0.4 is dominated by (0.5, 0.5)
const withDominated = [...bundles, { qty: new Map(), cost: 0, A: 0.4, B: 0.4 }];
const front2 = pareto(withDominated);
assert(front2.length === 5, "Dominated (0.4, 0.4) removed from frontier");

// ─── Floor selection ────────────────────────────────────────────────────────

console.log("\n=== 2b: Floor Selection ===");

// floor=0.5: must have A >= 0.5. Options: (0.9,0.1), (0.7,0.3), (0.5,0.5)
// Max B with A >= 0.5 → (0.5, 0.5)
const pick05 = floorSelect(front, 0.5);
assert(pick05 !== null, "floor=0.5: found a pick");
assertClose(pick05!.A, 0.5, "floor=0.5: picks A=0.5");
assertClose(pick05!.B, 0.5, "floor=0.5: picks B=0.5");

// floor=0.0: no constraint. Max B → (0.1, 0.7)
const pick00 = floorSelect(front, 0.0);
assertClose(pick00!.B, 0.7, "floor=0.0: picks B=0.7 (max)");

// floor=0.95: only (0.9,0.1) qualifies... but A=0.9 < 0.95. None qualify.
const pick095 = floorSelect(front, 0.95);
assert(pick095 === null, "floor=0.95: no bundle qualifies");

// ─── Method 3 Integration ───────────────────────────────────────────────────

console.log("\n=== 2b: Method 3 Integration ===");

// gameX ($5), gameY ($10), gameZ ($2)
// budget=$50, goal=$100
const integrationGames = [gameX, gameY, gameZ];

// High risk: maximize B, no floor constraint
const m3high = recommend(integrationGames, 50, 100, "high");
assert(m3high.routingTrace.method === "full_search", "Routes to full_search");
assert(m3high.status === "ok" || m3high.status === "goal_unreachable_at_risk",
  "Returns valid status");
assert(m3high.recommended.length > 0, "Has recommendations");
assert(m3high.pReachGoal > 0, `B > 0 (got ${m3high.pReachGoal})`);
assert(m3high.pWinAnything > 0, `A > 0 (got ${m3high.pWinAnything})`);
assert(m3high.ceilingProb !== undefined, "Has ceiling probability");

// Low risk: should respect A >= 0.85 floor
const m3low = recommend(integrationGames, 50, 100, "low");
assert(m3low.routingTrace.method === "full_search", "Low risk also routes to full_search");
if (m3low.status === "ok") {
  assert(m3low.pWinAnything >= 0.85, `Low risk: A >= 0.85 floor (got ${m3low.pWinAnything})`);
}

// The ceiling B (ignoring risk) should be >= the risk-constrained B
if (m3high.ceilingProb !== undefined && m3low.ceilingProb !== undefined) {
  assert(
    m3high.pReachGoal >= m3low.pReachGoal - 0.001,
    `High risk B (${m3high.pReachGoal}) >= low risk B (${m3low.pReachGoal})`
  );
}

// Mid risk: balanced
const m3mid = recommend(integrationGames, 50, 100, "mid");
assert(m3mid.routingTrace.method === "full_search", "Mid risk routes to full_search");

// Budget constraints: total spend should not exceed budget
for (const result of [m3high, m3low, m3mid]) {
  const totalSpend = result.recommended.reduce((s, e) => s + e.spend, 0);
  assert(totalSpend <= 50, `Total spend $${totalSpend} <= $50 budget`);
}

// ─── Escalation test ────────────────────────────────────────────────────────

console.log("\n=== 2b: Escalation ===");

// Very high goal relative to budget — should escalate
// gameZ only has $5 and $10 prizes. goal=$100, budget=$10
// pWin(gameZ) = 500/1000 = 0.5
// Stacking: cheapest=$2, maxTickets=5, pMax (< $100) = $10. 5*10=50 < 100 → single_hit, not full_search!
// Need a setup where stacking passes but goal is still hard.
// gameX: has $100 tier. gameZ has $10 max.
// goal=$100, budget=$15. cheapest=$2, maxTickets=7. pMax (<100) = $50 (gameX). 7*50=350 >= 100 → full_search ✓
// But $100 is barely reachable with $15 budget (3 tickets of gameX or 7 of gameZ).
// P(reach $100) will be small.
const escResult = recommend([gameX, gameZ], 15, 100, "low");
assert(escResult.routingTrace.method === "full_search", "Escalation test routes to full_search");
// With low risk floor=0.85, reaching $100 on $15 is very constrained
// May or may not escalate depending on achievable probabilities
console.log(`  → status: ${escResult.status}, B=${escResult.pReachGoal}, A=${escResult.pWinAnything}`);

// ─── probReachG direct test ─────────────────────────────────────────────────

console.log("\n=== 2a: probReachG Direct ===");

// 2 tickets of game30 (price=$5, prize=$30, net=$25, pWin=0.2), goal=$40 (net)
// B = P(net ≥ $40) = P(both win, net $25+$25=$50 → cap) = 0.2 * 0.2 = 0.04
const gLut30 = new Map([[20, game30]]);
const b30 = addToBundle(createBundle(), game30, 2);
const memo30 = new Map<string, Float64Array>();
const B30 = probReachG(b30, gLut30, 1, 40, memo30);
assertClose(B30, 0.04, "probReachG: 2× G30, goal=$40 net → B=0.04");

// A for same bundle: 1 - (1-0.2)^2 = 1 - 0.64 = 0.36
const A30 = computeCoverage(b30, gLut30);
assertClose(A30, 0.36, "coverage: 2× G30 → A=0.36");

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
