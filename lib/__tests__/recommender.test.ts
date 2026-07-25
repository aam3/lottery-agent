/**
 * Verification tests for lib/recommender.ts — Phase 1 (router, Methods 1-2).
 * Run: npx tsx lib/__tests__/recommender.test.ts
 */

import {
  type GameData,
  route,
  recommend,
  pWin,
  pGeG,
  evPerDollar,
  topPrize,
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
    console.log(`  ✓ ${label} (${actual.toFixed(6)})`);
  } else {
    failed++;
    console.log(`  ✗ ${label}: expected ${expected}, got ${actual}`);
  }
}

// ─── Synthetic game data ────────────────────────────────────────────────────

// Game A: $5 ticket, 1000 total remaining, 200 winning tickets across tiers
// tiers: $10 (100 remaining), $50 (80 remaining), $500 (20 remaining)
// LOSING: 800 remaining (included in totalRemaining but not in tiers)
const gameA: GameData = {
  gameId: 1,
  gameName: "Game A",
  gameNumber: "001",
  price: 5,
  imageUrl: null,
  tiers: [
    { prizeValue: 10, remaining: 100 },
    { prizeValue: 50, remaining: 80 },
    { prizeValue: 500, remaining: 20 },
  ],
  totalRemaining: 1000,
};

// Game B: $10 ticket, 2000 total remaining, 500 winning tickets
// tiers: $20 (300 remaining), $100 (150 remaining), $1000 (50 remaining)
const gameB: GameData = {
  gameId: 2,
  gameName: "Game B",
  gameNumber: "002",
  price: 10,
  imageUrl: null,
  tiers: [
    { prizeValue: 20, remaining: 300 },
    { prizeValue: 100, remaining: 150 },
    { prizeValue: 1000, remaining: 50 },
  ],
  totalRemaining: 2000,
};

// Game C: $2 ticket, 5000 total remaining, 1500 winning tickets
// tiers: $5 (1000 remaining), $10 (400 remaining), $20 (100 remaining)
const gameC: GameData = {
  gameId: 3,
  gameName: "Game C",
  gameNumber: "003",
  price: 2,
  imageUrl: null,
  tiers: [
    { prizeValue: 5, remaining: 1000 },
    { prizeValue: 10, remaining: 400 },
    { prizeValue: 20, remaining: 100 },
  ],
  totalRemaining: 5000,
};

// Game D: $30 ticket, only high-value prizes, low win rate
// tiers: $10000 (5 remaining)
const gameD: GameData = {
  gameId: 4,
  gameName: "Game D",
  gameNumber: "004",
  price: 30,
  imageUrl: null,
  tiers: [{ prizeValue: 10000, remaining: 5 }],
  totalRemaining: 10000,
};

const allGames = [gameA, gameB, gameC, gameD];

// ─── Derived quantities ─────────────────────────────────────────────────────

console.log("\n=== Derived Quantities ===");

// Game A: pWin = 200/1000 = 0.2
assertClose(pWin(gameA), 0.2, "gameA pWin");
// Game B: pWin = 500/2000 = 0.25
assertClose(pWin(gameB), 0.25, "gameB pWin");
// Game C: pWin = 1500/5000 = 0.3
assertClose(pWin(gameC), 0.3, "gameC pWin");

// pGeG uses net profit (prizeValue - price)
// Game A (price=$5): tiers net = $5, $45, $495
// pGeG(gameA, 45) → net >= 45: $50 tier (net=$45, 80) + $500 tier (net=$495, 20) = 100/1000 = 0.1
assertClose(pGeG(gameA, 45), 0.1, "gameA pGeG(45)");
// Game B (price=$10): tiers net = $10, $90, $990
// pGeG(gameB, 90) → net >= 90: $100 tier (net=$90, 150) + $1000 tier (net=$990, 50) = 200/2000 = 0.1
assertClose(pGeG(gameB, 90), 0.1, "gameB pGeG(90)");
// Game A: pGeG(gameA, 495) → net >= 495: $500 tier (net=$495, 20) = 20/1000 = 0.02
assertClose(pGeG(gameA, 495), 0.02, "gameA pGeG(495)");

// evPerDollar: Game A = (10*100 + 50*80 + 500*20) / 1000 / 5 = (1000+4000+10000)/1000/5 = 15/5 = 3.0
assertClose(evPerDollar(gameA), 3.0, "gameA evPerDollar");

// topPrize
assert(topPrize(gameA) === 500, "gameA topPrize = 500");
assert(topPrize(gameB) === 1000, "gameB topPrize = 1000");
assert(topPrize(gameD) === 10000, "gameD topPrize = 10000");

// ─── Router Tests ───────────────────────────────────────────────────────────

console.log("\n=== Router ===");

// goal=0 → coverage
const r1 = route(allGames, 50, 0);
assert(r1.method === "coverage", "goal=0 → coverage");

// goal=$3 (at or below smallest net profit $3 from gameC: $5-$2) → coverage
const r2 = route(allGames, 50, 3);
assert(r2.method === "coverage", "goal <= smallest net profit → coverage");

// goal=$500, budget=$10 → cheapest=$2, maxTickets=5
// Net profits < 500: gameC max=$18, gameA max=$495, gameB max=$90
// pMax=$495. 5×495=2475 >= 500 → full_search
const r3 = route(allGames, 10, 500);
assert(r3.method === "full_search", "goal=$500, budget=$10 → full_search (5×$495=$2475 >= $500)");

// goal=$10000, budget=$3 → cheapest=$2, maxTickets=1
// maxTickets < 2 → single_hit
const r4 = route(allGames, 3, 10000);
assert(r4.method === "single_hit", "maxTickets=1 → single_hit");

// goal=$50, budget=$100 → cheapest=$2, maxTickets=50
// Net profits < 50: gameC=$18, gameA=$45, gameB=$10. pMax=$45.
// 50×45=2250 >= 50 → full_search
const r5 = route(allGames, 100, 50);
assert(r5.method === "full_search", "goal=$50, budget=$100 → full_search (stacking possible)");

// Use only gameC for a single_hit test: gameC max net=$18
// goal=$100, budget=$5 → cheapest=$2, maxTickets=2. pMax=$18. 2×18=36 < 100 → single_hit
// But no game has net >= 100, so feasibility gate triggers (goal_unreachable)
const r6 = route([gameC], 5, 100);
assert(r6.method === "single_hit", "goal=$100 with only gameC → single_hit (can't stack)");

// ─── Method 1: Coverage ─────────────────────────────────────────────────────

console.log("\n=== Method 1: Coverage ===");

// With budget=$20, goal=0 — should maximize P(win anything)
const m1 = recommend(allGames, 20, 0, "low");
assert(m1.status === "ok", "Method 1 returns ok status");
assert(m1.routingTrace.method === "coverage", "Routed to coverage");
assert(m1.recommended.length > 0, "Has recommended games");

// Coverage density: -ln(1-p) / price
// Game A: -ln(0.8) / 5 = 0.2231/5 = 0.04463
// Game B: -ln(0.75) / 10 = 0.2877/10 = 0.02877
// Game C: -ln(0.7) / 2 = 0.3567/2 = 0.17835  ← highest density
// Game D: -ln(1-0.0005) / 30 = 0.0005/30 = 0.0000167
// Game C wins. $20 / $2 = 10 tickets of Game C.
assert(
  m1.recommended[0]?.gameName === "Game C",
  "Coverage picks Game C (highest density)"
);
assert(m1.recommended[0]?.qty === 10, "Buys 10 tickets of Game C");

// A = 1 - (1 - 0.3)^10 = 1 - 0.7^10 = 1 - 0.02825 = 0.97175
assertClose(m1.pWinAnything, 0.97175, "A = P(win anything)", 0.001);
assertClose(m1.pReachGoal, m1.pWinAnything, "pReachGoal = pWinAnything for coverage");

// Budget fully spent
const totalSpent = m1.recommended.reduce((sum, e) => sum + e.spend, 0);
assert(totalSpent === 20, "Budget fully spent ($20)");

// ─── Method 2: Single-Hit ───────────────────────────────────────────────────

console.log("\n=== Method 2: Single-Hit ===");

// Use only gameA and gameB for single_hit tests.
// Game A (price=$5): max net = $495. Game B (price=$10): max net = $990.
// goal=$5000, budget=$10. cheapest=$5, maxTickets=2.
// pMax (net < 5000) = $990. 2 × $990 = $1980 < $5000 → single_hit.
// Game B has $1000 tier, net $990 — does NOT reach $5000 net.
// No game has net >= $5000 → feasibility gate.
const gamesAB = [gameA, gameB];
const m2unreachable = recommend(gamesAB, 10, 5000, "high");
assert(m2unreachable.routingTrace.method === "single_hit", "Routed to single_hit");
assert(m2unreachable.status === "goal_unreachable", "No game has net >= $5000 → goal_unreachable");

// Use [gameA, gameD] so smallestNetProfit=$5 (gameA) keeps goal=$5000 out of coverage.
// budget=$35: cheapest=$5 (gameA), maxTickets=7.
// pMax (net < 5000) = $495 (gameA). 7×495=3465 < 5000 → single_hit.
// gameD has net=$9970 >= $5000, so feasibility passes.
const gamesAD = [gameA, gameD];

const m2high = recommend(gamesAD, 35, 5000, "high");
assert(m2high.routingTrace.method === "single_hit", "Routed to single_hit");
assert(m2high.status === "ok", "Method 2 high risk → ok status");
assert(
  m2high.recommended.some((e) => e.gameName === "Game D"),
  "Recommends Game D"
);
// k = floor(35/30) = 1 ticket of Game D.
// pGeG(gameD, 5000): net=$9970 >= $5000, remaining=5, total=10000. p=0.0005.
// P(reach) = 1 - (1-0.0005)^1 = 0.0005
assertClose(m2high.pReachGoal, 0.0005, "P(reach $5000 net) = 0.05%", 0.0001);

// Risk conflict: low risk + moonshot → escalation
const m2low = recommend(gamesAD, 35, 5000, "low");
assert(
  m2low.status === "goal_unreachable_at_risk",
  "Method 2 low risk → goal_unreachable_at_risk"
);
assert(
  m2low.message.includes("doesn't match"),
  "Low risk escalation message includes tradeoff language"
);
assert(
  m2low.message.includes("lower your goal") || m2low.message.includes("raise your budget"),
  "Escalation offers alternatives"
);

// Mid risk also triggers conflict
const m2mid = recommend(gamesAD, 35, 5000, "mid");
assert(
  m2mid.status === "goal_unreachable_at_risk",
  "Method 2 mid risk → goal_unreachable_at_risk"
);

// ─── Budget Too Small ───────────────────────────────────────────────────────

console.log("\n=== Edge Cases ===");

const m_small = recommend(allGames, 1, 0, "low");
assert(m_small.status === "budget_too_small", "Budget $1 < cheapest $2 → budget_too_small");

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
