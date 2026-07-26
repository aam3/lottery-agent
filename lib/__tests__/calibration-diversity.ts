// Diversity Factor Calibration
// Runs the recommender with different DIVERSITY values to see bundle composition.
// Focused on cases that showed concentration problems.
// Usage: npx tsx lib/__tests__/calibration-diversity.ts

import { readFileSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { recommend, CONFIG, type GameData, type Tier, type Risk } from "../recommender";

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
    FROM games g
    JOIN prizes p ON p.game_id = g.game_id
    WHERE g.state = 'NJ' AND g.is_active = true
    ORDER BY g.game_id, p.prize_value DESC NULLS LAST
  `;

  const gamesMap = new Map<number, GameData & { tiers: Tier[]; totalRemaining: number }>();
  for (const r of rows) {
    const gid = r.game_id as number;
    const remaining = r.prizes_remaining as number;
    const prizeValue = r.prize_value as number | null;
    if (!gamesMap.has(gid)) {
      gamesMap.set(gid, {
        gameId: gid, gameName: r.game_name as string, gameNumber: r.game_number as string,
        price: r.price_tier as number, imageUrl: r.image_url as string | null,
        tiers: [], totalRemaining: 0,
      });
    }
    const game = gamesMap.get(gid)!;
    game.totalRemaining += remaining;
    if (prizeValue !== null && prizeValue > 0 && remaining > 0) {
      game.tiers.push({ prizeValue, remaining });
    }
  }
  return Array.from(gamesMap.values()).filter((g) => g.tiers.length > 0 && g.totalRemaining > 0);
}

function fmtBundle(result: ReturnType<typeof recommend>): string {
  if (result.recommended.length === 0) return "—";
  return result.recommended
    .map((r) => `${r.qty}× ${r.gameName} ($${r.price})`)
    .join(" + ");
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

// Test cases that showed concentration in the first calibration
const CASES: Array<{ budget: number; goal: number; risk: Risk }> = [
  // Coverage (goal=0) — these all went 100% Loose Change
  { budget: 50, goal: 0, risk: "low" },
  { budget: 100, goal: 0, risk: "low" },
  { budget: 200, goal: 0, risk: "low" },
  { budget: 500, goal: 0, risk: "low" },
  // Break-even — mixed results
  { budget: 50, goal: 50, risk: "low" },
  { budget: 50, goal: 50, risk: "mid" },
  { budget: 50, goal: 50, risk: "high" },
  { budget: 100, goal: 100, risk: "low" },
  { budget: 100, goal: 100, risk: "mid" },
  { budget: 200, goal: 200, risk: "low" },
  { budget: 200, goal: 200, risk: "mid" },
  // Low goal / high budget — went 100% Loose Change
  { budget: 200, goal: 50, risk: "low" },
  { budget: 500, goal: 50, risk: "low" },
  { budget: 500, goal: 100, risk: "low" },
  { budget: 500, goal: 500, risk: "low" },
  { budget: 500, goal: 500, risk: "mid" },
];

const D_VALUES = [1, 3, 5];

async function main() {
  const games = await fetchNJGames();
  console.log(`${games.length} active NJ games.\n`);

  for (const { budget, goal, risk } of CASES) {
    const label = `$${budget} budget / ${goal === 0 ? "any" : "$" + goal} goal / ${risk} risk`;
    console.log(`\n${"=".repeat(80)}`);
    console.log(label);
    console.log("=".repeat(80));

    for (const D of D_VALUES) {
      // Mutate CONFIG for this run
      (CONFIG as any).DIVERSITY = D;
      const t0 = performance.now();
      const result = recommend(games, budget, goal, risk);
      const ms = performance.now() - t0;
      const nGames = result.recommended.length;

      console.log(`  D=${D}: [${result.status}] P(goal)=${fmtPct(result.pReachGoal)} P(win)=${fmtPct(result.pWinAnything)} ${ms.toFixed(0)}ms | ${nGames} games | ${fmtBundle(result)}`);
    }
  }

  // Reset
  (CONFIG as any).DIVERSITY = 1;
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
