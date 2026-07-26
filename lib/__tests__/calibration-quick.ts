// Quick: budget=goal cases at D=1 vs D=2
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

async function main() {
  const games = await fetchNJGames();
  const budgets = [10, 20, 50, 100, 200, 500];

  for (const budget of budgets) {
    (CONFIG as any).DIVERSITY = 1;
    const r1 = recommend(games, budget, budget, "low");
    (CONFIG as any).DIVERSITY = 2;
    const r2 = recommend(games, budget, budget, "low");
    const drop = ((r1.pReachGoal - r2.pReachGoal) * 100).toFixed(1);
    console.log(`$${budget}/$${budget}: D=1 ${(r1.pReachGoal*100).toFixed(1)}% → D=2 ${(r2.pReachGoal*100).toFixed(1)}% (${drop === "0.0" ? "no change" : `-${drop}pp`})`);
  }
  (CONFIG as any).DIVERSITY = 1;
}

main().catch(console.error);
