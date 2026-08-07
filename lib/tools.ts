import { sql } from "@/lib/db";
import { formatPrize, formatWinRate, formatROI, formatOdds, DEFAULT_THRESHOLDS } from "@/lib/formatters";

// ─── Retrieval tools ────────────────────────────────────────────────────────

export async function get_freshness(params: { state: string }) {
  try {
    const rows = await sql`
      SELECT abbreviation AS state, name, last_scraped_at, is_active
      FROM states
      WHERE abbreviation = ${params.state.toUpperCase()}
    `;
    if (rows.length === 0) {
      return { error: `No state found for abbreviation: ${params.state}` };
    }
    return rows[0];
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

const SORT_COLUMNS: Record<string, string> = {
  price_tier: "price_tier",
  game_number: "game_number",
  game_name: "game_name",
};

export async function query_games(params: {
  state: string;
  price_tier?: number;
  game_id?: number;
  game_name?: string;
  game_number?: string;
  sort_by?: string;
  limit?: number;
}) {
  const { state, price_tier, game_id, game_name, game_number, sort_by, limit } = params;
  const cap = Math.min(Math.max(limit ?? 200, 1), 200);
  const sortCol = SORT_COLUMNS[sort_by ?? "price_tier"] ?? "price_tier";

  try {
    // Build conditions array for dynamic filtering
    const conditions: string[] = [`state = '${state.toUpperCase()}'`, `is_active = true`];
    if (price_tier !== undefined) conditions.push(`price_tier = ${price_tier}`);
    if (game_id !== undefined) conditions.push(`game_id = ${game_id}`);
    if (game_name !== undefined) conditions.push(`game_name = '${game_name}'`);
    if (game_number !== undefined) conditions.push(`game_number = '${game_number}'`);

    // Use parameterized queries for safety — branch by filter combination
    let rows;
    if (game_id !== undefined) {
      rows = await sql`
        SELECT game_id, game_number, game_name, state, price_tier,
               image_url, is_active
        FROM games
        WHERE state = ${state.toUpperCase()} AND is_active = true AND game_id = ${game_id}
      `;
    } else if (game_number !== undefined) {
      rows = await sql`
        SELECT game_id, game_number, game_name, state, price_tier,
               image_url, is_active
        FROM games
        WHERE state = ${state.toUpperCase()} AND is_active = true AND game_number = ${game_number}
      `;
    } else if (game_name !== undefined && price_tier !== undefined) {
      rows = await sql`
        SELECT game_id, game_number, game_name, state, price_tier,
               image_url, is_active
        FROM games
        WHERE state = ${state.toUpperCase()} AND is_active = true
              AND game_name = ${game_name} AND price_tier = ${price_tier}
        LIMIT ${cap}
      `;
    } else if (game_name !== undefined) {
      rows = await sql`
        SELECT game_id, game_number, game_name, state, price_tier,
               image_url, is_active
        FROM games
        WHERE state = ${state.toUpperCase()} AND is_active = true AND game_name = ${game_name}
        LIMIT ${cap}
      `;
    } else if (price_tier !== undefined) {
      if (sortCol === "game_number") {
        rows = await sql`
          SELECT game_id, game_number, game_name, state, price_tier,
                 image_url, is_active
          FROM games
          WHERE state = ${state.toUpperCase()} AND is_active = true AND price_tier = ${price_tier}
          ORDER BY game_number
          LIMIT ${cap}
        `;
      } else if (sortCol === "game_name") {
        rows = await sql`
          SELECT game_id, game_number, game_name, state, price_tier,
                 image_url, is_active
          FROM games
          WHERE state = ${state.toUpperCase()} AND is_active = true AND price_tier = ${price_tier}
          ORDER BY game_name
          LIMIT ${cap}
        `;
      } else {
        rows = await sql`
          SELECT game_id, game_number, game_name, state, price_tier,
                 image_url, is_active
          FROM games
          WHERE state = ${state.toUpperCase()} AND is_active = true AND price_tier = ${price_tier}
          ORDER BY price_tier
          LIMIT ${cap}
        `;
      }
    } else {
      if (sortCol === "game_number") {
        rows = await sql`
          SELECT game_id, game_number, game_name, state, price_tier,
                 image_url, is_active
          FROM games
          WHERE state = ${state.toUpperCase()} AND is_active = true
          ORDER BY game_number
          LIMIT ${cap}
        `;
      } else if (sortCol === "game_name") {
        rows = await sql`
          SELECT game_id, game_number, game_name, state, price_tier,
                 image_url, is_active
          FROM games
          WHERE state = ${state.toUpperCase()} AND is_active = true
          ORDER BY game_name
          LIMIT ${cap}
        `;
      } else {
        rows = await sql`
          SELECT game_id, game_number, game_name, state, price_tier,
                 image_url, is_active
          FROM games
          WHERE state = ${state.toUpperCase()} AND is_active = true
          ORDER BY price_tier
          LIMIT ${cap}
        `;
      }
    }

    return { games: rows, count: rows.length };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

export async function search_games(params: {
  state: string;
  query?: string;
  game_number?: string;
}) {
  const { state, query, game_number } = params;

  if (!query && !game_number) {
    return { error: "Provide query (game name search) or game_number." };
  }

  try {
    let rows;
    if (game_number) {
      rows = await sql`
        SELECT game_id, game_number, game_name, state, price_tier, image_url
        FROM games
        WHERE state = ${state.toUpperCase()} AND is_active = true AND game_number = ${game_number}
      `;
    } else {
      const pattern = `%${query}%`;
      rows = await sql`
        SELECT game_id, game_number, game_name, state, price_tier, image_url
        FROM games
        WHERE state = ${state.toUpperCase()} AND is_active = true AND game_name ILIKE ${pattern}
        ORDER BY game_name
        LIMIT 20
      `;
    }

    return { games: rows, count: rows.length };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

export async function get_prizes(params: {
  game_ids: number[];
  state?: string;
  game_numbers?: string[];
}) {
  const { game_ids, state, game_numbers } = params;

  try {
    let rows;
    if (game_ids && game_ids.length > 0) {
      rows = await sql`
        SELECT p.prize_id, p.game_id, p.prize_label, p.prize_value,
               p.is_free_ticket, p.scrape_date,
               g.game_name, g.game_number, g.price_tier, g.state, g.image_url
        FROM prizes p
        JOIN games g ON g.game_id = p.game_id
        WHERE p.game_id = ANY(${game_ids})
        ORDER BY p.game_id, p.prize_value DESC NULLS LAST
      `;
    } else if (state && game_numbers && game_numbers.length > 0) {
      rows = await sql`
        SELECT p.prize_id, p.game_id, p.prize_label, p.prize_value,
               p.is_free_ticket, p.scrape_date,
               g.game_name, g.game_number, g.price_tier, g.state, g.image_url
        FROM prizes p
        JOIN games g ON g.game_id = p.game_id
        WHERE g.state = ${state.toUpperCase()} AND g.game_number = ANY(${game_numbers})
        ORDER BY p.game_id, p.prize_value DESC NULLS LAST
      `;
    } else {
      return { error: "Provide game_ids or state with game_numbers." };
    }

    if (rows.length === 0) {
      return { error: "No prizes found for the specified game(s)." };
    }

    // Group rows by game_id
    const gamesMap = new Map<number, Record<string, unknown>>();
    for (const r of rows) {
      const gid = r.game_id as number;
      if (!gamesMap.has(gid)) {
        gamesMap.set(gid, {
          game_id: r.game_id,
          game_name: r.game_name,
          game_number: r.game_number,
          price_tier: r.price_tier,
          state: r.state,
          image_url: r.image_url,
          prizes: [],
        });
      }
      (gamesMap.get(gid)!.prizes as Record<string, unknown>[]).push({
        prize_id: r.prize_id,
        prize_label: r.prize_label,
        prize_value: r.prize_value,
        is_free_ticket: r.is_free_ticket,
        scrape_date: r.scrape_date,
      });
    }

    const games = Array.from(gamesMap.values());
    if (games.length === 1) {
      return games[0];
    }
    return { games, count: games.length };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

export async function get_prize_snapshots(params: {
  game_id: number;
  prize_id?: number;
}) {
  const { game_id, prize_id } = params;

  try {
    let rows;
    if (prize_id !== undefined) {
      rows = await sql`
        SELECT ps.snapshot_id, ps.prize_id, ps.prizes_remaining, ps.scrape_date,
               p.prize_label, p.prize_value
        FROM prize_snapshots ps
        JOIN prizes p ON p.prize_id = ps.prize_id
        WHERE p.game_id = ${game_id} AND ps.prize_id = ${prize_id}
        ORDER BY ps.scrape_date DESC
      `;
    } else {
      rows = await sql`
        SELECT ps.snapshot_id, ps.prize_id, ps.prizes_remaining, ps.scrape_date,
               p.prize_label, p.prize_value
        FROM prize_snapshots ps
        JOIN prizes p ON p.prize_id = ps.prize_id
        WHERE p.game_id = ${game_id}
        ORDER BY ps.prize_id, ps.scrape_date DESC
      `;
    }

    return { game_id, snapshots: rows };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

// ─── Metric tools ───────────────────────────────────────────────────────────


function normalizeIds(params: { game_ids: number[] }): number[] | null {
  return params.game_ids.length > 0 ? params.game_ids : null;
}

export async function get_outcome_probabilities(params: {
  game_ids: number[];
}) {
  const ids = normalizeIds(params);
  if (!ids) return { error: "Provide game_id or game_ids." };

  try {
    const rows = await sql`
      SELECT gm.game_id, g.game_name, g.game_number, g.price_tier, g.state,
             gm.p_losing, gm.p_breaking_even, gm.p_winning_cash, gm.computed_at
      FROM game_metrics gm
      JOIN games g ON g.game_id = gm.game_id
      WHERE gm.game_id = ANY(${ids})
    `;
    return { metrics: rows };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

export async function get_marginal_odds(params: {
  game_ids: number[];
  thresholds: number[];
}) {
  const ids = normalizeIds(params);
  if (!ids) return { error: "Provide game_id or game_ids." };

  const thresholds = params.thresholds;

  try {
    const rows = await sql`
      SELECT p.prize_value, p.prizes_remaining,
             g.game_id, g.game_name, g.game_number, g.price_tier, g.state
      FROM prizes p
      JOIN games g ON g.game_id = p.game_id
      WHERE p.game_id = ANY(${ids})
      ORDER BY p.game_id, p.prize_value DESC NULLS LAST
    `;

    // Group rows by game, accumulate totalRemaining across all tiers
    const gamesMap = new Map<number, {
      game_id: number; game_name: string; game_number: string;
      price_tier: number; state: string; totalRemaining: number;
      tiers: Array<{ prize_value: number | null; prizes_remaining: number }>;
    }>();

    for (const r of rows) {
      const gid = r.game_id as number;
      const remaining = r.prizes_remaining as number;
      if (!gamesMap.has(gid)) {
        gamesMap.set(gid, {
          game_id: gid,
          game_name: r.game_name as string,
          game_number: r.game_number as string,
          price_tier: r.price_tier as number,
          state: r.state as string,
          totalRemaining: 0,
          tiers: [],
        });
      }
      const game = gamesMap.get(gid)!;
      game.totalRemaining += remaining;
      game.tiers.push({
        prize_value: r.prize_value as number | null,
        prizes_remaining: remaining,
      });
    }

    const metrics = Array.from(gamesMap.values()).map((game) => {
      if (game.totalRemaining === 0) {
        return {
          game_id: game.game_id, game_name: game.game_name,
          game_number: game.game_number, price_tier: game.price_tier,
          state: game.state,
          error: "No tickets remaining for this game.",
        };
      }

      const marginal_odds: Record<string, number> = {};
      for (const t of thresholds) {
        const qualifying = game.tiers
          .filter((tier) =>
            tier.prize_value !== null &&
            tier.prizes_remaining > 0 &&
            (tier.prize_value - game.price_tier) >= t
          )
          .reduce((sum, tier) => sum + tier.prizes_remaining, 0);
        marginal_odds[`mo_${t}`] = qualifying / game.totalRemaining;
      }

      return {
        game_id: game.game_id, game_name: game.game_name,
        game_number: game.game_number, price_tier: game.price_tier,
        state: game.state, marginal_odds, thresholds_used: thresholds,
      };
    });

    return { metrics };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

export async function get_depletion(params: {
  game_ids: number[];
}) {
  const ids = normalizeIds(params);
  if (!ids) return { error: "Provide game_id or game_ids." };

  try {
    const rows = await sql`
      SELECT gm.game_id, g.game_name, g.game_number, g.state,
             gm.depletion_high, gm.depletion_mid, gm.depletion_low, gm.computed_at
      FROM game_metrics gm
      JOIN games g ON g.game_id = gm.game_id
      WHERE gm.game_id = ANY(${ids})
    `;
    return { metrics: rows };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

export async function get_risk_reward(params: {
  game_ids: number[];
}) {
  const ids = normalizeIds(params);
  if (!ids) return { error: "Provide game_id or game_ids." };

  try {
    const rows = await sql`
      SELECT gm.game_id, g.game_name, g.game_number, g.price_tier, g.state, g.image_url,
             gm.reward_raw, gm.risk_raw, gm.roi, gm.computed_at
      FROM game_metrics gm
      JOIN games g ON g.game_id = gm.game_id
      WHERE gm.game_id = ANY(${ids})
      ORDER BY gm.reward_raw DESC NULLS LAST
    `;
    return { metrics: rows };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

export async function get_top_prizes(params: {
  game_ids: number[];
}) {
  const ids = normalizeIds(params);
  if (!ids) return { error: "Provide game_id or game_ids." };

  try {
    const rows = await sql`
      SELECT p.prize_value, p.total_tickets, p.prizes_remaining, p.prize_label,
             g.game_id, g.game_name, g.game_number, g.price_tier, g.state, g.image_url
      FROM prizes p
      JOIN games g ON g.game_id = p.game_id
      WHERE p.game_id = ANY(${ids})
        AND p.prize_value IS NOT NULL
        AND p.total_tickets IS NOT NULL
      ORDER BY p.game_id, p.prize_value DESC NULLS LAST
    `;

    // Group all tiers by game, compute top prize probability
    const gamesMap = new Map<number, {
      game_id: number; game_name: string; game_number: string;
      price_tier: number; state: string; image_url: string | null;
      top_prize_value: number; top_prize_label: string;
      top_prize_tickets: number; top_prizes_remaining: number | null;
      total_tickets_sum: number;
    }>();

    for (const r of rows) {
      const gid = r.game_id as number;
      const tierTickets = r.total_tickets as number;

      if (!gamesMap.has(gid)) {
        // First row per game is the top prize (ORDER BY prize_value DESC)
        gamesMap.set(gid, {
          game_id: gid,
          game_name: r.game_name as string,
          game_number: r.game_number as string,
          price_tier: r.price_tier as number,
          state: r.state as string,
          image_url: r.image_url as string | null,
          top_prize_value: r.prize_value as number,
          top_prize_label: r.prize_label as string,
          top_prize_tickets: tierTickets,
          top_prizes_remaining: r.prizes_remaining as number | null,
          total_tickets_sum: tierTickets,
        });
      } else {
        gamesMap.get(gid)!.total_tickets_sum += tierTickets;
      }
    }

    const metrics = Array.from(gamesMap.values()).map((game) => {
      const probability = game.total_tickets_sum > 0
        ? game.top_prize_tickets / game.total_tickets_sum
        : null;

      return {
        game_id: game.game_id, game_name: game.game_name,
        game_number: game.game_number, price_tier: game.price_tier,
        state: game.state, image_url: game.image_url,
        top_prize_value: game.top_prize_value,
        top_prize_label: game.top_prize_label,
        top_prize_probability: probability,
        top_prizes_remaining: game.top_prizes_remaining,
      };
    });

    return { metrics };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

// ─── Recommendation tool ──────────────────────────────────────────────────────

import { recommend, budgetProbe, resAndCap, type Risk, type GameData, type Tier } from "@/lib/recommender";

export async function optimize_multi_ticket_bundle(params: {
  game_ids: number[];
  budget: number;
  goal: number;
  risk: string;
}) {
  const { game_ids, budget, goal, risk } = params;

  // Input validation
  if (!game_ids || !Array.isArray(game_ids) || game_ids.length === 0) {
    return { error: "game_ids is required (array of game IDs from query_games)." };
  }
  if (typeof budget !== "number" || budget <= 0) {
    return { error: `Invalid budget: ${budget}. Must be a positive number.` };
  }
  if (typeof goal !== "number" || goal < 0) {
    return { error: `Invalid goal: ${goal}. Must be 0 (win anything) or a positive dollar amount.` };
  }
  const validRisks = ["low", "mid", "high"];
  if (!validRisks.includes(risk)) {
    return { error: `Invalid risk: ${risk}. Must be 'low', 'mid', or 'high'.` };
  }

  try {
    const rows = await sql`
      SELECT g.game_id, g.game_name, g.game_number, g.price_tier, g.image_url,
             p.prize_value, p.prizes_remaining, p.is_free_ticket
      FROM games g
      JOIN prizes p ON p.game_id = g.game_id
      WHERE g.game_id = ANY(${game_ids})
      ORDER BY g.game_id, p.prize_value DESC NULLS LAST
    `;

    if (rows.length === 0) {
      return { error: "No games found for the provided game_ids." };
    }

    // Transform rows into GameData[]
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

      // Winning tiers only: prize_value > 0 and remaining > 0
      if (prizeValue !== null && prizeValue > 0 && remaining > 0) {
        game.tiers.push({ prizeValue, remaining });
      }
    }

    // Filter to games with at least one winning tier and totalRemaining > 0
    const games: GameData[] = Array.from(gamesMap.values()).filter(
      (g) => g.tiers.length > 0 && g.totalRemaining > 0
    );

    if (games.length === 0) {
      return { error: "No games with remaining prizes found for the provided game_ids." };
    }

    const result = recommend(games, budget, goal, risk as Risk);
    return result;
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

// ─── Budget probe ──────────────────────────────────────────────────────────────

export async function probe_budget_for_goal(params: {
  game_ids: number[];
  goal: number;
  budget: number;
}) {
  const { game_ids, goal, budget } = params;

  if (!game_ids || !Array.isArray(game_ids) || game_ids.length === 0) {
    return { error: "game_ids is required (array of game IDs)." };
  }
  if (typeof goal !== "number" || goal <= 0) {
    return { error: `Invalid goal: ${goal}. Must be a positive dollar amount.` };
  }
  if (typeof budget !== "number" || budget <= 0) {
    return { error: `Invalid budget: ${budget}. Must be a positive number.` };
  }

  try {
    const rows = await sql`
      SELECT g.game_id, g.game_name, g.game_number, g.price_tier, g.image_url,
             p.prize_value, p.prizes_remaining, p.is_free_ticket
      FROM games g
      JOIN prizes p ON p.game_id = g.game_id
      WHERE g.game_id = ANY(${game_ids})
      ORDER BY g.game_id, p.prize_value DESC NULLS LAST
    `;

    if (rows.length === 0) {
      return { error: "No games found for the provided game_ids." };
    }

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

    const games: GameData[] = Array.from(gamesMap.values()).filter(
      (g) => g.tiers.length > 0 && g.totalRemaining > 0
    );

    if (games.length === 0) {
      return { error: "No games with remaining prizes found." };
    }

    const gamesLut = new Map(games.map((g) => [g.gameId, g]));
    const message = budgetProbe(games, gamesLut, goal, budget);

    return { goal, current_budget: budget, message };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

// ─── Explore tools ───────────────────────────────────────────────────────────


export async function build_game_card(params: {
  game_id?: number;
  state?: string;
  game_number?: string;
}) {
  let { game_id } = params;
  const { state, game_number } = params;

  // Resolve game_id from state + game_number if not provided directly
  if (!game_id && state && game_number) {
    const lookup = await sql`
      SELECT game_id FROM games
      WHERE state = ${state.toUpperCase()} AND game_number = ${game_number}
    `;
    if (lookup.length === 0) {
      return { error: `No game found for state ${state}, game_number ${game_number}` };
    }
    game_id = lookup[0].game_id as number;
  }

  if (!game_id) {
    return { error: "Provide game_id, or state + game_number." };
  }

  try {
    // Query game metadata + outcome probabilities
    const metricRows = await sql`
      SELECT gm.game_id, g.game_name, g.game_number, g.price_tier, g.image_url,
             gm.p_losing, gm.roi
      FROM game_metrics gm
      JOIN games g ON g.game_id = gm.game_id
      WHERE gm.game_id = ${game_id}
    `;
    if (metricRows.length === 0) {
      return { error: `No metrics found for game_id: ${game_id}` };
    }
    const game = metricRows[0];

    // Query top prize
    const topPrizeRows = await sql`
      SELECT p.prize_value, p.prizes_remaining
      FROM prizes p
      WHERE p.game_id = ${game_id}
        AND p.prize_value IS NOT NULL
      ORDER BY p.prize_value DESC NULLS LAST
      LIMIT 1
    `;

    const topPrizeValue = topPrizeRows.length > 0 ? (topPrizeRows[0].prize_value as number) : 0;
    const topPrizesRemaining = topPrizeRows.length > 0 ? (topPrizeRows[0].prizes_remaining as number) : null;

    const priceTier = game.price_tier as number;
    const pLosing = game.p_losing as number;
    const roi = game.roi as number;

    return {
      blocks: [
        {
          type: "game_stats_summary",
          game_name: game.game_name,
          game_number: game.game_number,
          game_id,
          image_url: game.image_url ?? null,
          metrics: [
            { label: "Price", value: `$${priceTier}` },
            { label: "Top Prize", value: formatPrize(topPrizeValue), suffix: topPrizesRemaining !== null ? `(${topPrizesRemaining} left)` : undefined },
            { label: "Win Rate", value: formatWinRate(pLosing) },
            { label: "ROI", value: formatROI(roi) },
          ],
        },
      ],
    };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

// ─── Response formatting ──────────────────────────────────────────────────────

export async function render_response(params: { blocks: unknown[] | string }) {
  // Defensive parse: models sometimes serialize the blocks array as a JSON string
  if (typeof params.blocks === "string") {
    try {
      params.blocks = JSON.parse(params.blocks);
    } catch {
      return { error: "Invalid blocks: expected an array of content blocks." };
    }
  }

  if (!Array.isArray(params.blocks)) {
    return { error: "Invalid blocks: expected an array of content blocks." };
  }

  // Repair: if a text block ends with a question followed by a list of
  // options, extract them into a proper choices block. Works backwards
  // from the end of each text block using line-by-line detection rather
  // than a single regex — handles varied bullet styles, blank lines
  // between items, and numbered lists.
  for (let i = params.blocks.length - 1; i >= 0; i--) {
    const block = params.blocks[i] as { type: string; content?: string };
    if (block.type !== "text" || !block.content) continue;

    const lines = block.content.split("\n");

    // Scan backwards to find contiguous list items at the end
    const isBullet = (s: string) =>
      /^\s*[-*•]\s+/.test(s) || /^\s*\d+[.)]\s+/.test(s);
    let listStartIdx = lines.length;
    for (let j = lines.length - 1; j >= 0; j--) {
      if (lines[j].trim().length === 0) continue; // skip blank lines
      if (isBullet(lines[j])) {
        listStartIdx = j;
      } else {
        break;
      }
    }

    // Need at least 2 list items
    const listLines = lines
      .slice(listStartIdx)
      .filter((l) => l.trim().length > 0);
    if (listLines.length < 2) continue;

    // Find the last question line (ending with ?) before the list
    let questionIdx = -1;
    for (let j = listStartIdx - 1; j >= 0; j--) {
      const trimmed = lines[j].trim();
      if (trimmed.length === 0) continue; // skip blank lines
      if (trimmed.endsWith("?")) {
        questionIdx = j;
      }
      break; // stop at first non-blank line — question or not
    }
    if (questionIdx === -1) continue;

    // Extract question and options
    const question = lines[questionIdx].trim();
    const options = listLines
      .map((l) =>
        l
          .trim()
          .replace(/^\s*[-*•]\s+/, "")
          .replace(/^\s*\d+[.)]\s+/, "")
          .replace(/\*\*/g, "")
          .trim()
      )
      .filter((o) => o.length > 0);

    if (options.length < 2) continue;

    // Keep text before the question line
    const before = lines.slice(0, questionIdx).join("\n").trim();
    if (before.length > 0) {
      block.content = before;
    } else {
      params.blocks.splice(i, 1);
    }

    // Insert the choices block
    const insertAt = before.length > 0 ? i + 1 : i;
    params.blocks.splice(insertAt, 0, {
      type: "choices",
      prompt: question,
      options: options.some((o) => /something else/i.test(o))
        ? options
        : [...options, "Something else"],
    });
    break;
  }

  const hasChoices = params.blocks.some(
    (b) => (b as { type: string }).type === "choices"
  );
  const hasExploreOptions = params.blocks.some(
    (b) => (b as { type: string }).type === "explore_options"
  );
  const hasDataBlocks = params.blocks.some(
    (b) => !["text", "choices", "explore_options", "freshness"].includes(
      (b as { type: string }).type
    )
  );

  // Data-driven responses (game cards, tables, etc.) must include interaction
  if (hasDataBlocks && !hasChoices && !hasExploreOptions) {
    return {
      error:
        "Response has no user interaction. Include a choices block or pass through explore_options from an explore tool.",
    };
  }

  // When a choices block is present, strip trailing question from the last
  // text block to avoid the agent asking the same question twice (once in
  // prose, once in the choices block).
  if (hasChoices) {
    for (let i = params.blocks.length - 1; i >= 0; i--) {
      const block = params.blocks[i] as { type: string; content?: string };
      if (block.type === "text" && block.content) {
        const stripped = block.content.replace(/([.!])\s+[^.!]*\?\s*$/, "$1").trim();
        if (stripped.length > 0 && stripped !== block.content.trim()) {
          block.content = stripped;
        }
        break;
      }
    }
  }

  // Pass blocks through. Display order (interactive before freshness,
  // content before interactive) is enforced by the frontend BlockRenderer.
  return { blocks: params.blocks as unknown[] };
}

// ─── Dispatcher map (for Phase 2 agent loop) ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toolHandlers: Record<string, (params: any) => Promise<unknown>> = {
  get_freshness,
  query_games,
  search_games,
  get_prizes,
  get_prize_snapshots,
  get_outcome_probabilities,
  get_marginal_odds,
  get_depletion,
  get_risk_reward,
  get_top_prizes,
  optimize_multi_ticket_bundle,
  probe_budget_for_goal,
  build_game_card,
  render_response,
};
