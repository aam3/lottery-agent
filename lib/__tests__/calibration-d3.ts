// D=3 probability impact across a wide range of budget/goal combos
// Usage: npx tsx lib/__tests__/calibration-d3.ts

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

const BUDGETS = [10, 20, 30, 50, 75, 100, 150, 200, 300, 500];
const RISKS: Risk[] = ["low", "mid", "high"];

function pct(n: number): string { return (n * 100).toFixed(1) + "%"; }
function pad(s: string, w: number): string { return s.padEnd(w); }

async function main() {
  const games = await fetchNJGames();

  console.log("D=3 vs D=1: probability impact across budget/goal/risk combos");
  console.log("Only showing cases where D=3 differs from D=1.\n");

  console.log(pad("Budget", 8) + pad("Goal", 8) + pad("Risk", 6) +
    pad("D=1 P(g)", 10) + pad("D=3 P(g)", 10) + pad("Drop", 8) +
    pad("D=1 P(w)", 10) + pad("D=3 P(w)", 10) + pad("Games", 8));
  console.log("-".repeat(78));

  let totalCases = 0;
  let changedCases = 0;

  for (const budget of BUDGETS) {
    // Goals: 0, break-even, and a spread of ratios
    const goals = new Set([0, budget]);
    for (const ratio of [0.25, 0.5, 1, 2, 5]) {
      const g = Math.round(budget * ratio);
      if (g <= budget * 20) goals.add(g);
    }

    for (const goal of [...goals].sort((a, b) => a - b)) {
      for (const risk of RISKS) {
        // Skip goal > budget * 20
        if (goal > budget * 20) continue;

        totalCases++;

        (CONFIG as any).DIVERSITY = 1;
        const r1 = recommend(games, budget, goal, risk);

        (CONFIG as any).DIVERSITY = 3;
        const r3 = recommend(games, budget, goal, risk);

        const dropGoal = (r1.pReachGoal - r3.pReachGoal) * 100;
        const dropWin = (r1.pWinAnything - r3.pWinAnything) * 100;

        // Only show if there's a difference
        if (Math.abs(dropGoal) >= 0.05 || Math.abs(dropWin) >= 0.05) {
          changedCases++;
          console.log(
            pad(`$${budget}`, 8) + pad(goal === 0 ? "any" : `$${goal}`, 8) + pad(risk, 6) +
            pad(pct(r1.pReachGoal), 10) + pad(pct(r3.pReachGoal), 10) +
            pad(dropGoal === 0 ? "0" : `${dropGoal > 0 ? "-" : "+"}${Math.abs(dropGoal).toFixed(1)}pp`, 8) +
            pad(pct(r1.pWinAnything), 10) + pad(pct(r3.pWinAnything), 10) +
            pad(`${r1.recommended.length}→${r3.recommended.length}`, 8)
          );
        }
      }
    }
  }

  console.log(`\n${changedCases}/${totalCases} cases affected by D=3`);
  (CONFIG as any).DIVERSITY = 1;
}

main().catch(console.error);
