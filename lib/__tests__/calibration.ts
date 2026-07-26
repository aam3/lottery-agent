// Phase 5 Calibration Script
// Runs the recommender against real NJ data across a matrix of budget/goal/risk combos.
// Usage: npx tsx lib/__tests__/calibration.ts

import { readFileSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

// Load .env.local (Next.js convention, no dotenv dependency)
const envPath = resolve(__dirname, "../../.env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}
import { recommend, type GameData, type Tier, type Risk } from "../recommender";

const sql = neon(process.env.DATABASE_URL!);

// ─── Fetch real NJ game data ────────────────────────────────────────────────

async function fetchNJGames(): Promise<GameData[]> {
  const rows = await sql`
    SELECT g.game_id, g.game_name, g.game_number, g.price_tier, g.image_url,
           p.prize_value, p.prizes_remaining, p.is_free_ticket
    FROM games g
    JOIN prizes p ON p.game_id = g.game_id
    WHERE g.state = 'NJ' AND g.is_active = true
    ORDER BY g.game_id, p.prize_value DESC NULLS LAST
  `;

  const gamesMap = new Map<number, {
    gameId: number; gameName: string; gameNumber: string;
    price: number; imageUrl: string | null;
    tiers: Tier[]; totalRemaining: number;
  }>();

  for (const r of rows) {
    const gid = r.game_id as number;
    const remaining = r.prizes_remaining as number;
    const prizeValue = r.prize_value as number | null;

    if (!gamesMap.has(gid)) {
      gamesMap.set(gid, {
        gameId: gid,
        gameName: r.game_name as string,
        gameNumber: r.game_number as string,
        price: r.price_tier as number,
        imageUrl: r.image_url as string | null,
        tiers: [],
        totalRemaining: 0,
      });
    }

    const game = gamesMap.get(gid)!;
    game.totalRemaining += remaining;

    if (prizeValue !== null && prizeValue > 0 && remaining > 0) {
      game.tiers.push({ prizeValue, remaining });
    }
  }

  return Array.from(gamesMap.values()).filter(
    (g) => g.tiers.length > 0 && g.totalRemaining > 0
  );
}

// ─── Test matrix ────────────────────────────────────────────────────────────

const BUDGETS = [10, 20, 50, 100, 200, 500];
const FIXED_GOALS = [0, 50, 100, 500, 1000, 5000];
const RISKS: Risk[] = ["low", "mid", "high"];

function buildCombos(): Array<{ budget: number; goal: number; risk: Risk }> {
  const combos: Array<{ budget: number; goal: number; risk: Risk }> = [];
  const seen = new Set<string>();

  for (const budget of BUDGETS) {
    // Build goal list: fixed goals + break-even (goal = budget)
    const goals = new Set([...FIXED_GOALS, budget]);

    for (const goal of goals) {
      // Skip unrealistic: goal > budget × 20
      if (goal > budget * 20) continue;

      for (const risk of RISKS) {
        const key = `${budget}-${goal}-${risk}`;
        if (seen.has(key)) continue;
        seen.add(key);
        combos.push({ budget, goal, risk });
      }
    }
  }

  return combos;
}

// ─── Format helpers ─────────────────────────────────────────────────────────

function fmtBundle(result: ReturnType<typeof recommend>): string {
  if (result.recommended.length === 0) return "—";
  return result.recommended
    .map((r) => `${r.qty}× ${r.gameName} ($${r.price})`)
    .join(" + ");
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function pad(s: string, w: number): string {
  return s.padEnd(w);
}

// ─── Run ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching NJ game data...");
  const games = await fetchNJGames();
  console.log(`Found ${games.length} active NJ games with remaining prizes.\n`);

  const gameIds = games.map((g) => `${g.gameName} ($${g.price})`);
  console.log("Games:", gameIds.join(", "), "\n");

  const combos = buildCombos();
  console.log(`Running ${combos.length} combinations...\n`);

  // Header
  const header = [
    pad("Budget", 8),
    pad("Goal", 8),
    pad("Risk", 6),
    pad("Method", 12),
    pad("Status", 25),
    pad("P(goal)", 9),
    pad("P(win)", 9),
    pad("Time", 7),
    "Bundle",
  ].join(" | ");
  console.log(header);
  console.log("-".repeat(header.length + 20));

  // Summary counters
  const summary = { total: 0, ok: 0, escalated: 0, unreachable: 0, budgetSmall: 0 };
  const escalationsByRisk: Record<Risk, number> = { low: 0, mid: 0, high: 0 };
  const totalByRisk: Record<Risk, number> = { low: 0, mid: 0, high: 0 };

  for (const { budget, goal, risk } of combos) {
    const t0 = performance.now();
    const result = recommend(games, budget, goal, risk);
    const ms = performance.now() - t0;

    summary.total++;
    totalByRisk[risk]++;
    if (result.status === "ok") summary.ok++;
    else if (result.status === "goal_unreachable_at_risk") {
      summary.escalated++;
      escalationsByRisk[risk]++;
    } else if (result.status === "goal_unreachable") summary.unreachable++;
    else if (result.status === "budget_too_small") summary.budgetSmall++;

    const row = [
      pad(`$${budget}`, 8),
      pad(goal === 0 ? "any" : `$${goal}`, 8),
      pad(risk, 6),
      pad(result.routingTrace.method, 12),
      pad(result.status, 25),
      pad(fmtPct(result.pReachGoal), 9),
      pad(fmtPct(result.pWinAnything), 9),
      pad(ms.toFixed(0) + "ms", 7),
      fmtBundle(result),
    ].join(" | ");
    console.log(row);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total combos: ${summary.total}`);
  console.log(`OK: ${summary.ok} | Escalated: ${summary.escalated} | Unreachable: ${summary.unreachable} | Budget too small: ${summary.budgetSmall}`);
  console.log(`\nEscalation rate by risk level:`);
  for (const risk of RISKS) {
    const rate = totalByRisk[risk] > 0 ? (escalationsByRisk[risk] / totalByRisk[risk] * 100).toFixed(0) : "0";
    console.log(`  ${risk}: ${escalationsByRisk[risk]}/${totalByRisk[risk]} (${rate}%)`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
