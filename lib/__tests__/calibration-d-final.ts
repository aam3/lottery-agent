// Final D formula probability impact: log10(totalTickets/5)^(D-1)
// Tests D=1 (baseline), D=2, D=3 across all budget/goal combos
// Usage: npx tsx lib/__tests__/calibration-d-final.ts

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

function pct(n: number): string { return (n * 100).toFixed(1) + "%"; }
function pad(s: string, w: number): string { return s.padEnd(w); }

const BUDGETS = [10, 20, 50, 100, 200, 500];
const RISKS: Risk[] = ["low", "mid", "high"];

async function main() {
  const games = await fetchNJGames();

  // Part 1: Show cap % at each budget for D=2 and D=3
  console.log("EFFECTIVE CAP PER PRICE TIER (as % of total tickets)");
  console.log("-".repeat(50));
  const cheapest = Math.min(...games.map(g => g.price));
  for (const budget of BUDGETS) {
    const t = Math.floor(budget / cheapest);
    for (const D of [2, 3]) {
      const divisor = Math.max(1, Math.pow(Math.log10(t / 5), D - 1));
      const cap = Math.max(1, Math.floor(t / divisor));
      const pctCap = Math.min(100, (cap / t * 100)).toFixed(0);
      console.log(`  $${budget} (${t} tickets) D=${D}: cap=${cap} (${pctCap}%)`);
    }
  }

  // Part 2: Probability impact
  console.log("\n\nPROBABILITY IMPACT: D=2 and D=3 vs D=1");
  console.log("Only showing cases where probability changes.\n");
  console.log(pad("Case", 25) +
    pad("D=1 P(g)", 10) + pad("D=2 P(g)", 10) + pad("Δ", 8) +
    pad("D=3 P(g)", 10) + pad("Δ", 8) +
    pad("D=1 gms", 8) + pad("D=2 gms", 8) + pad("D=3 gms", 8));
  console.log("-".repeat(95));

  let total = 0;
  let d2Changed = 0;
  let d3Changed = 0;

  for (const budget of BUDGETS) {
    const goals = new Set([0, budget]);
    for (const ratio of [0.25, 0.5, 1, 2, 5, 10]) {
      const g = Math.round(budget * ratio);
      if (g <= budget * 20) goals.add(g);
    }

    for (const goal of [...goals].sort((a, b) => a - b)) {
      if (goal > budget * 20) continue;
      for (const risk of RISKS) {
        total++;

        (CONFIG as any).DIVERSITY = 1;
        const r1 = recommend(games, budget, goal, risk);
        (CONFIG as any).DIVERSITY = 2;
        const r2 = recommend(games, budget, goal, risk);
        (CONFIG as any).DIVERSITY = 3;
        const r3 = recommend(games, budget, goal, risk);

        const d2drop = (r1.pReachGoal - r2.pReachGoal) * 100;
        const d3drop = (r1.pReachGoal - r3.pReachGoal) * 100;

        if (Math.abs(d2drop) >= 0.05 || Math.abs(d3drop) >= 0.05) {
          if (Math.abs(d2drop) >= 0.05) d2Changed++;
          if (Math.abs(d3drop) >= 0.05) d3Changed++;

          const label = `$${budget}/${goal === 0 ? "any" : "$" + goal}/${risk}`;
          console.log(
            pad(label, 25) +
            pad(pct(r1.pReachGoal), 10) +
            pad(pct(r2.pReachGoal), 10) +
            pad(d2drop === 0 ? "0" : `${d2drop > 0 ? "-" : "+"}${Math.abs(d2drop).toFixed(1)}pp`, 8) +
            pad(pct(r3.pReachGoal), 10) +
            pad(d3drop === 0 ? "0" : `${d3drop > 0 ? "-" : "+"}${Math.abs(d3drop).toFixed(1)}pp`, 8) +
            pad(String(r1.recommended.length), 8) +
            pad(String(r2.recommended.length), 8) +
            pad(String(r3.recommended.length), 8)
          );
        }
      }
    }
  }

  console.log(`\nTotal cases: ${total}`);
  console.log(`D=2 changed: ${d2Changed}`);
  console.log(`D=3 changed: ${d3Changed}`);

  (CONFIG as any).DIVERSITY = 1;
}

main().catch(console.error);
