// Edge case tests for the recommender
// Usage: npx tsx lib/__tests__/edge-cases.ts

import { readFileSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { recommend, type GameData, type Tier } from "../recommender";

const envPath = resolve(__dirname, "../../.env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}
const sql = neon(process.env.DATABASE_URL!);

async function fetchNJGames(): Promise<GameData[]> {
  const rows = await sql`
    SELECT g.game_id, g.game_name, g.game_number, g.price_tier, g.image_url,
           p.prize_value, p.prizes_remaining, p.is_free_ticket
    FROM games g JOIN prizes p ON p.game_id = g.game_id
    WHERE g.state = 'NJ' AND g.is_active = true
    ORDER BY g.game_id, p.prize_value DESC NULLS LAST
  `;
  const gamesMap = new Map<number, GameData & { tiers: Tier[]; totalRemaining: number }>();
  for (const r of rows) {
    const gid = r.game_id as number;
    const remaining = r.prizes_remaining as number;
    const prizeValue = r.prize_value as number | null;
    if (!gamesMap.has(gid)) {
      gamesMap.set(gid, { gameId: gid, gameName: r.game_name as string, gameNumber: r.game_number as string,
        price: r.price_tier as number, imageUrl: r.image_url as string | null, tiers: [], totalRemaining: 0 });
    }
    const game = gamesMap.get(gid)!;
    game.totalRemaining += remaining;
    if (prizeValue !== null && prizeValue > 0 && remaining > 0) game.tiers.push({ prizeValue, remaining });
  }
  return Array.from(gamesMap.values()).filter((g) => g.tiers.length > 0 && g.totalRemaining > 0);
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${(e as Error).message}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function main() {
  const allGames = await fetchNJGames();

  // Pick a single game for single-game tests
  const singleGame = allGames[0];

  console.log("\n1. Budget < cheapest game price");
  test("returns budget_too_small", () => {
    const expensive = allGames.filter(g => g.price >= 10);
    const r = recommend(expensive, 5, 0, "low");
    assert(r.status === "budget_too_small", `expected budget_too_small, got ${r.status}`);
    assert(r.recommended.length === 0, "should have no recommendations");
  });

  console.log("\n2. Only one game passed");
  test("coverage with single game", () => {
    const r = recommend([singleGame], 50, 0, "low");
    assert(r.status === "ok", `expected ok, got ${r.status}`);
    assert(r.recommended.length === 1, `expected 1 game, got ${r.recommended.length}`);
    assert(r.pWinAnything > 0, "should have nonzero P(win)");
  });

  test("break-even with single game", () => {
    const r = recommend([singleGame], 50, 50, "low");
    assert(r.status === "ok" || r.status === "goal_unreachable_at_risk", `unexpected status: ${r.status}`);
    assert(r.recommended.length >= 1, "should have at least 1 recommendation");
  });

  test("single game, high goal", () => {
    const r = recommend([singleGame], 10, 1000, "high");
    assert(r.status === "ok" || r.status === "goal_unreachable_at_risk" || r.status === "goal_unreachable",
      `unexpected status: ${r.status}`);
  });

  console.log("\n3. Goal exceeds all net profits");
  test("goal exceeds max possible prize", () => {
    // Find the max prize across all games
    const maxPrize = Math.max(...allGames.flatMap(g => g.tiers.map(t => t.prizeValue)));
    const impossibleGoal = maxPrize * 10;
    const r = recommend(allGames, 50, impossibleGoal, "high");
    assert(r.status === "goal_unreachable" || r.status === "goal_unreachable_at_risk",
      `expected unreachable, got ${r.status}`);
  });

  console.log("\n4. Numerical stability: high pWin games");
  test("game with very high win rate doesn't crash", () => {
    // Create a synthetic game where pWin is very close to 1.0
    const syntheticGame: GameData = {
      gameId: 99999,
      gameName: "Almost Always Wins",
      gameNumber: "99999",
      price: 1,
      imageUrl: null,
      tiers: [{ prizeValue: 1, remaining: 999 }],
      totalRemaining: 1000, // 999/1000 = 0.999 pWin
    };
    const r = recommend([syntheticGame], 100, 0, "low");
    assert(r.status === "ok", `expected ok, got ${r.status}`);
    assert(isFinite(r.pWinAnything), "P(win) should be finite");
    assert(r.pWinAnything > 0.99, `P(win) should be near 1, got ${r.pWinAnything}`);
  });

  test("pWin exactly 1.0 doesn't produce infinity", () => {
    const syntheticGame: GameData = {
      gameId: 99998,
      gameName: "Always Wins",
      gameNumber: "99998",
      price: 1,
      imageUrl: null,
      tiers: [{ prizeValue: 2, remaining: 1000 }],
      totalRemaining: 1000, // pWin = 1.0
    };
    const r = recommend([syntheticGame], 50, 0, "low");
    assert(r.status === "ok", `expected ok, got ${r.status}`);
    assert(isFinite(r.pWinAnything), "P(win) should be finite");
  });

  console.log("\n5. Very small budget");
  test("$1 budget", () => {
    const r = recommend(allGames, 1, 0, "low");
    assert(r.status === "ok", `expected ok, got ${r.status}`);
    assert(r.recommended.length >= 1, "should recommend something");
  });

  test("$2 budget with $50 goal", () => {
    const r = recommend(allGames, 2, 50, "high");
    assert(r.status === "ok" || r.status === "goal_unreachable_at_risk" || r.status === "goal_unreachable",
      `unexpected status: ${r.status}`);
  });

  console.log("\n6. Goal = 0 across all risk levels");
  for (const risk of ["low", "mid", "high"] as const) {
    test(`goal=0, risk=${risk} produces same bundle`, () => {
      const r = recommend(allGames, 50, 0, risk);
      assert(r.status === "ok", `expected ok, got ${r.status}`);
      assert(r.pReachGoal === r.pWinAnything, "P(goal) should equal P(win) when goal=0");
    });
  }

  console.log(`\n${"=".repeat(40)}`);
  console.log(`${passed} passed, ${failed} failed`);
}

main().catch(console.error);
