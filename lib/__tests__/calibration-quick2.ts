import { readFileSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { recommend, CONFIG, type GameData, type Tier } from "../recommender";

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

const CASES = [
  { budget: 500, goal: 0, label: "$500/any" },
  { budget: 500, goal: 50, label: "$500/$50" },
  { budget: 500, goal: 100, label: "$500/$100" },
  { budget: 200, goal: 0, label: "$200/any" },
  { budget: 200, goal: 50, label: "$200/$50" },
];

async function main() {
  const games = await fetchNJGames();

  for (const { budget, goal, label } of CASES) {
    console.log(`\n${label} (low risk):`);
    for (const D of [1, 2, 3]) {
      (CONFIG as any).DIVERSITY = D;
      const r = recommend(games, budget, goal, "low");
      const bundle = r.recommended.map(e => `${e.qty}× ${e.gameName} ($${e.price})`).join(" + ");
      const drop = D === 1 ? "" : (() => {
        (CONFIG as any).DIVERSITY = 1;
        const base = recommend(games, budget, goal, "low");
        (CONFIG as any).DIVERSITY = D;
        return ` (${((base.pReachGoal - r.pReachGoal) * 100).toFixed(1)}pp drop)`;
      })();
      console.log(`  D=${D}: P(goal)=${(r.pReachGoal*100).toFixed(1)}%${drop} | ${r.recommended.length} games | ${bundle}`);
    }
  }
  (CONFIG as any).DIVERSITY = 1;
}

main().catch(console.error);
