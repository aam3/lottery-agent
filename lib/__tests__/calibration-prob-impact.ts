// Probability impact of diversity factor
// For each budget/goal combo, shows how P(goal) and P(win) change as D increases.
// Usage: npx tsx lib/__tests__/calibration-prob-impact.ts

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

const CASES: Array<{ budget: number; goal: number; risk: Risk }> = [
  // Coverage
  { budget: 50, goal: 0, risk: "low" },
  { budget: 100, goal: 0, risk: "low" },
  { budget: 200, goal: 0, risk: "low" },
  { budget: 500, goal: 0, risk: "low" },
  // Break-even
  { budget: 50, goal: 50, risk: "low" },
  { budget: 100, goal: 100, risk: "low" },
  { budget: 200, goal: 200, risk: "low" },
  // Low goal relative to budget
  { budget: 100, goal: 50, risk: "low" },
  { budget: 200, goal: 50, risk: "low" },
  { budget: 500, goal: 50, risk: "low" },
  { budget: 500, goal: 100, risk: "low" },
  // Mid/high risk
  { budget: 50, goal: 50, risk: "mid" },
  { budget: 50, goal: 50, risk: "high" },
  { budget: 100, goal: 100, risk: "mid" },
  { budget: 200, goal: 200, risk: "mid" },
];

const D_VALUES = [1, 3, 5, 8];

function pct(n: number): string { return (n * 100).toFixed(1) + "%"; }
function pad(s: string, w: number): string { return s.padEnd(w); }

async function main() {
  const games = await fetchNJGames();

  // Header
  console.log(pad("Case", 35) + " | " + D_VALUES.map(d => pad(`D=${d} P(goal)`, 12) + pad(`P(win)`, 9) + pad("games", 6)).join(" | "));
  console.log("-".repeat(35 + D_VALUES.length * 30));

  for (const { budget, goal, risk } of CASES) {
    const label = `$${budget}/${goal === 0 ? "any" : "$" + goal}/${risk}`;
    const results: string[] = [];

    for (const D of D_VALUES) {
      (CONFIG as any).DIVERSITY = D;
      const result = recommend(games, budget, goal, risk);
      results.push(
        pad(pct(result.pReachGoal), 12) +
        pad(pct(result.pWinAnything), 9) +
        pad(String(result.recommended.length), 6)
      );
    }

    console.log(pad(label, 35) + " | " + results.join(" | "));
  }

  // Show the delta: how much does D=3 and D=5 lose vs D=1?
  console.log("\n\nPROBABILITY LOSS vs D=1 (P(goal) drop in percentage points)");
  console.log("-".repeat(80));
  console.log(pad("Case", 35) + " | " + [3, 5, 8].map(d => pad(`D=${d}`, 10)).join(" | "));
  console.log("-".repeat(80));

  for (const { budget, goal, risk } of CASES) {
    const label = `$${budget}/${goal === 0 ? "any" : "$" + goal}/${risk}`;

    (CONFIG as any).DIVERSITY = 1;
    const baseline = recommend(games, budget, goal, risk);

    const deltas: string[] = [];
    for (const D of [3, 5, 8]) {
      (CONFIG as any).DIVERSITY = D;
      const result = recommend(games, budget, goal, risk);
      const drop = (baseline.pReachGoal - result.pReachGoal) * 100;
      deltas.push(pad(drop === 0 ? "0" : `-${drop.toFixed(1)}pp`, 10));
    }

    console.log(pad(label, 35) + " | " + deltas.join(" | "));
  }

  (CONFIG as any).DIVERSITY = 1;
}

main().catch(console.error);
