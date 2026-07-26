// Quick perf check: the cases that were 20-88 seconds before
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
  { budget: 50, goal: 500 },
  { budget: 50, goal: 1000 },
  { budget: 100, goal: 1000 },
  { budget: 200, goal: 1000 },
  { budget: 500, goal: 1000 },
  { budget: 500, goal: 5000 },
];

async function main() {
  const games = await fetchNJGames();
  (CONFIG as any).DIVERSITY = 2;

  for (const { budget, goal } of CASES) {
    const t0 = performance.now();
    const r = recommend(games, budget, goal, "low");
    const ms = performance.now() - t0;
    console.log(`$${budget}/$${goal}: ${ms.toFixed(0)}ms [${r.status}]`);
  }
}

main().catch(console.error);
