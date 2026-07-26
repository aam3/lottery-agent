// Diversity Factor Experiment
// Shows how different D values would constrain bundles for concentration-heavy cases.
// D = diversity factor: no game gets more than 1/D of total tickets in the bundle.
// Usage: npx tsx lib/__tests__/diversity-experiment.ts

import { readFileSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

const envPath = resolve(__dirname, "../../.env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const sql = neon(process.env.DATABASE_URL!);

interface GameInfo { name: string; price: number; }

async function fetchNJGames(): Promise<GameInfo[]> {
  const rows = await sql`
    SELECT DISTINCT g.game_name, g.price_tier
    FROM games g
    JOIN prizes p ON p.game_id = g.game_id
    WHERE g.state = 'NJ' AND g.is_active = true
      AND p.prize_value > 0 AND p.prizes_remaining > 0
    ORDER BY g.price_tier, g.game_name
  `;
  return rows.map((r) => ({ name: r.game_name as string, price: r.price_tier as number }));
}

const BUDGETS = [20, 50, 100, 200, 500];
const D_VALUES = [1, 2, 3, 5];

async function main() {
  const games = await fetchNJGames();

  // Group by price
  const byPrice = new Map<number, number>();
  for (const g of games) {
    byPrice.set(g.price, (byPrice.get(g.price) || 0) + 1);
  }

  console.log("NJ games by price tier:");
  for (const [price, count] of [...byPrice.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  $${price}: ${count} games`);
  }
  console.log(`  Total: ${games.length} games\n`);

  console.log("For each budget and D value:");
  console.log("  - totalTickets: how many tickets the budget buys at the cheapest price ($1)");
  console.log("  - maxPerGame: max tickets of any single game (totalTickets / D)");
  console.log("  - minGames: minimum distinct games needed to fill the budget\n");

  for (const budget of BUDGETS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`BUDGET: $${budget}`);
    console.log(`${"=".repeat(60)}`);

    // Show what happens at each price tier with each D
    const prices = [...byPrice.keys()].sort((a, b) => a - b);

    for (const D of D_VALUES) {
      console.log(`\n  D=${D}:`);
      let totalCapacity = 0;
      for (const price of prices) {
        const maxTicketsAtPrice = Math.floor(budget / price); // total possible at this price
        const maxPerGame = D === 1 ? maxTicketsAtPrice : Math.max(1, Math.floor(maxTicketsAtPrice / D));
        const gamesAtPrice = byPrice.get(price)!;
        const capacityAtPrice = maxPerGame * gamesAtPrice * price;
        totalCapacity += capacityAtPrice;
        console.log(`    $${price} tickets: max ${maxPerGame}/game × ${gamesAtPrice} games = $${maxPerGame * gamesAtPrice * price} capacity`);
      }
      console.log(`    Total capacity: $${totalCapacity} (budget: $${budget}) ${totalCapacity >= budget ? "✓ fills" : "✗ SHORT"}`);

      // What does a realistic bundle look like?
      // Greedy fill: start at cheapest, fill each game to maxPerGame, move to next
      let remaining = budget;
      const bundle: Array<{ price: number; qty: number; gamesUsed: number }> = [];
      for (const price of prices) {
        if (remaining < price) continue;
        const maxTicketsAtPrice = Math.floor(budget / price);
        const maxPerGame = D === 1 ? maxTicketsAtPrice : Math.max(1, Math.floor(maxTicketsAtPrice / D));
        const gamesAtPrice = byPrice.get(price)!;
        let ticketsAtPrice = 0;
        let gamesUsed = 0;
        for (let g = 0; g < gamesAtPrice && remaining >= price; g++) {
          const qty = Math.min(maxPerGame, Math.floor(remaining / price));
          if (qty > 0) {
            ticketsAtPrice += qty;
            gamesUsed++;
            remaining -= qty * price;
          }
        }
        if (ticketsAtPrice > 0) {
          bundle.push({ price, qty: ticketsAtPrice, gamesUsed });
        }
      }
      console.log(`    Example fill: ${bundle.map((b) => `${b.qty}× $${b.price} (${b.gamesUsed} games)`).join(", ")} | $${budget - remaining} spent, $${remaining} leftover`);
      console.log(`    Distinct games: ${bundle.reduce((s, b) => s + b.gamesUsed, 0)}`);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
