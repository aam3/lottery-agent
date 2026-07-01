import { sql } from "@/lib/db";

// ─── Reference content (hardcoded, not from DB) ────────────────────────────

const SCHEMA_TABLES: Record<string, object> = {
  games: {
    description:
      "One row per scratch-off game within a state. Uniquely identified by (game_number, state).",
    fields: {
      game_id: "Primary key (integer)",
      game_number: "State-assigned game identifier (string, format varies by state)",
      game_name: "Display name from the lottery site (not unique — editions reuse names)",
      state: "Two-letter state abbreviation",
      price_tier: "Ticket purchase price in dollars",
      overall_odds: "Raw odds string from site (e.g., '1 in 3.45'). NULL if not published.",
      overall_odds_numeric: "Parsed winning probability as decimal (e.g., 0.289855)",
      tickets_printed: "Total tickets printed for entire game. NULL if not published.",
      image_url: "Ticket image URL",
      is_active: "Whether the game is currently on the state's active listing page",
      updated_at: "Last time this game was updated by the scraper",
    },
  },
  prizes: {
    description:
      "One row per prize tier for a game. Represents current state as of most recent scrape.",
    fields: {
      prize_id: "Primary key (integer)",
      game_id: "FK to games",
      prize_label: "Raw prize text from site (e.g., '$10,000 A MONTH/LIF', 'FREE $5 TICKET', 'LOSING')",
      prize_value: "Numeric dollar value. NULL for unresolvable labels. Free tickets use ticket price. Annuity prizes store computed total payout.",
      total_tickets: "Total tickets printed for this tier. NULL when not published.",
      prizes_remaining: "Current unclaimed prize count",
      prize_odds: "Per-tier odds string (e.g., '1 in 1,000'). NULL if not published.",
      is_free_ticket: "Whether this tier is a free ticket prize",
      scrape_date: "Date of most recent scrape that updated this row",
    },
  },
  prize_snapshots: {
    description:
      "Historical record of remaining prize counts over time. Append-only, one row per tier per scrape date.",
    fields: {
      snapshot_id: "Primary key (integer)",
      prize_id: "FK to prizes",
      prizes_remaining: "Remaining count as of scrape_date",
      scrape_date: "Date this snapshot was captured",
    },
  },
  game_metrics: {
    description:
      "Derived analytical metrics, one row per game (one-to-one with games). Recomputed after each scrape.",
    fields: {
      game_id: "FK to games (unique — one-to-one)",
      p_losing: "Probability of losing (net value < 0)",
      p_breaking_even: "Probability of breaking even (net value = 0, includes free tickets)",
      p_winning_cash: "Probability of winning cash (net value > 0)",
      mo_0: "Marginal odds: probability of net profit >= $0",
      "mo_10 through mo_100000": "Marginal odds at thresholds: $10, $50, $100, $500, $1K, $5K, $10K, $50K, $100K",
      reward_raw: "Average profit per winning ticket (where prize > cost)",
      risk_raw: "Average loss per losing ticket (where prize < cost)",
      depletion_high: "Percentage of $500+ prizes remaining vs. original. NULL if no prizes in band.",
      depletion_mid: "Percentage of $50-$499 prizes remaining vs. original",
      depletion_low: "Percentage of under-$50 prizes remaining vs. original",
      computed_at: "When these metrics were last recomputed",
    },
  },
  states: {
    description: "One row per U.S. state lottery program.",
    fields: {
      state_id: "Primary key (integer)",
      name: "Full state name (e.g., 'New Jersey')",
      abbreviation: "Two-letter code (e.g., 'NJ')",
      lottery_url: "Root URL of state lottery site",
      last_scraped_at: "Timestamp of most recent completed scrape for this state",
      is_active: "Whether this state is currently being scraped",
    },
  },
};

const SCHEMA_CONCEPTS: Record<string, object> = {
  net_value: {
    definition: "prize_value - price_tier. The profit or loss from a single ticket.",
    examples: [
      "$10 prize on a $5 ticket = +$5 net value (winning)",
      "Free ticket on a $5 game = $0 net value (breaking even)",
      "Losing ticket on a $5 game = -$5 net value (losing)",
    ],
    important: "All metrics use net value, never raw prize value. The ticket cost is always factored in.",
  },
  outcome_probabilities: {
    definition: "Three mutually exclusive outcome probabilities that sum to 1.0. Prize-value agnostic — tells you the overall chance of each outcome, not the chance of winning a specific amount.",
    metrics: {
      p_losing: "Net value < 0. Includes losing tickets (prize_value = 0).",
      p_breaking_even: "Net value = 0. Includes free tickets and any prize equal to ticket cost.",
      p_winning_cash: "Net value > 0. Cash prizes that exceed the ticket cost.",
    },
  },
  marginal_odds: {
    definition: "Probability of winning at least a given net-profit threshold on a single ticket. Computed on-the-fly from prize tier data (total_tickets per tier / tickets_printed).",
    default_thresholds: [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000],
    threshold_parameter: "Omit for the default ladder (required for comparisons). Pass a single number for a specific target. Custom arrays are not accepted.",
    usage: "Lets users compare realistic win chances at specific dollar levels. A conservative player focuses on mo_0 (any win), a risk-tolerant player focuses on mo_500 or mo_1000.",
    interpretation: "Flat values across thresholds mean all wins exceed the lower threshold. A zero means no prizes reach that net profit level — but prize tiers may still exist in that dollar range (e.g., a $400 prize on a $20 ticket has $380 net profit, which is above mo_100 but below mo_500). Do not infer prize structure from marginal odds — use get_prizes for that.",
  },
  risk: {
    definition: "Average net loss per losing ticket (where net value < 0).",
    interpretation: "Describes only the loss side of the prize distribution. Should not be presented on its own — it only tells half the story. Use relative to reward.",
  },
  reward: {
    definition: "Average net gain per winning ticket (where net value > 0).",
    interpretation: "Describes only the reward side of the prize distribution. Should not be presented on its own — it only tells half the story. Use relative to risk.",
  },
  depletion: {
    definition: "What percentage of prizes remain vs. original supply, grouped into dollar bands.",
    bands: {
      high: "$500+ prizes",
      mid: "$50-$499 prizes",
      low: "Under $50 prizes",
    },
    interpretation: "Shows whether a game's prize pool is healthily stocked or picked over. NULL when no prizes exist in a band.",
  },
};

// ─── Reference lookup tool ──────────────────────────────────────────────────

export async function get_reference(params: {
  table_name?: string;
  concept?: string;
}) {
  const { table_name, concept } = params;

  if (table_name && concept) {
    return {
      table: SCHEMA_TABLES[table_name] ?? { error: `Unknown table: ${table_name}` },
      concept: SCHEMA_CONCEPTS[concept] ?? { error: `Unknown concept: ${concept}` },
    };
  }
  if (table_name) {
    return SCHEMA_TABLES[table_name] ?? { error: `Unknown table: ${table_name}` };
  }
  if (concept) {
    return SCHEMA_CONCEPTS[concept] ?? { error: `Unknown concept: ${concept}` };
  }
  return {
    tables: Object.entries(SCHEMA_TABLES).map(([name, info]) => ({
      name,
      description: (info as { description: string }).description,
    })),
    concepts: Object.keys(SCHEMA_CONCEPTS),
    hint: "Provide table_name to see field definitions, or concept to look up a metric meaning.",
  };
}

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
  threshold: number;
}) {
  const ids = normalizeIds(params);
  if (!ids) return { error: "Provide game_id or game_ids." };

  const thresholds = [params.threshold];

  try {
    const rows = await sql`
      SELECT p.prize_value, p.total_tickets,
             g.game_id, g.game_name, g.game_number, g.price_tier, g.state,
             g.tickets_printed
      FROM prizes p
      JOIN games g ON g.game_id = p.game_id
      WHERE p.game_id = ANY(${ids})
      ORDER BY p.game_id, p.prize_value DESC NULLS LAST
    `;

    // Group rows by game
    const gamesMap = new Map<number, {
      game_id: number; game_name: string; game_number: string;
      price_tier: number; state: string; tickets_printed: number | null;
      tiers: Array<{ prize_value: number | null; total_tickets: number | null }>;
    }>();

    for (const r of rows) {
      const gid = r.game_id as number;
      if (!gamesMap.has(gid)) {
        gamesMap.set(gid, {
          game_id: gid,
          game_name: r.game_name as string,
          game_number: r.game_number as string,
          price_tier: r.price_tier as number,
          state: r.state as string,
          tickets_printed: r.tickets_printed as number | null,
          tiers: [],
        });
      }
      gamesMap.get(gid)!.tiers.push({
        prize_value: r.prize_value as number | null,
        total_tickets: r.total_tickets as number | null,
      });
    }

    const metrics = Array.from(gamesMap.values()).map((game) => {
      if (!game.tickets_printed) {
        return {
          game_id: game.game_id, game_name: game.game_name,
          game_number: game.game_number, price_tier: game.price_tier,
          state: game.state,
          error: "tickets_printed not available for this game.",
        };
      }

      const marginal_odds: Record<string, number> = {};
      for (const t of thresholds) {
        const qualifying = game.tiers
          .filter((tier) =>
            tier.prize_value !== null &&
            tier.total_tickets !== null &&
            (tier.prize_value - game.price_tier) >= t
          )
          .reduce((sum, tier) => sum + (tier.total_tickets as number), 0);
        marginal_odds[`mo_${t}`] = qualifying / game.tickets_printed;
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

// ─── Computation tools ─────────────────────────────────────────────────────

export async function calculate_multi_ticket_odds(params: {
  budget: number;
  tickets: Array<{ probability: number; count: number; price_per_ticket: number }>;
}) {
  const { budget, tickets } = params;

  if (!tickets || tickets.length === 0) {
    return { error: "Provide at least one ticket entry with probability, count, and price_per_ticket." };
  }

  if (typeof budget !== "number" || budget <= 0) {
    return { error: `Invalid budget: ${budget}. Must be a positive number.` };
  }

  // Validate inputs
  for (const entry of tickets) {
    if (typeof entry.probability !== "number" || entry.probability < 0 || entry.probability > 1) {
      return { error: `Invalid probability: ${entry.probability}. Must be between 0 and 1.` };
    }
    if (!Number.isInteger(entry.count) || entry.count < 1) {
      return { error: `Invalid count: ${entry.count}. Must be a positive integer.` };
    }
    if (typeof entry.price_per_ticket !== "number" || entry.price_per_ticket <= 0) {
      return { error: `Invalid price_per_ticket: ${entry.price_per_ticket}. Must be a positive number.` };
    }
  }

  // Validate total cost does not exceed budget
  const totalCost = tickets.reduce((sum, t) => sum + t.count * t.price_per_ticket, 0);
  if (totalCost > budget) {
    return {
      error: `Total ticket cost ($${totalCost}) exceeds budget ($${budget}). Reduce ticket counts or choose cheaper games.`,
    };
  }

  const totalTickets = tickets.reduce((sum, t) => sum + t.count, 0);

  // P(all lose) = ∏(1 − pᵢ) for each individual ticket
  let allLoseProbability = 1;
  for (const entry of tickets) {
    allLoseProbability *= Math.pow(1 - entry.probability, entry.count);
  }

  return {
    combined_probability: 1 - allLoseProbability,
    all_lose_probability: allLoseProbability,
    total_tickets: totalTickets,
    total_cost: totalCost,
    budget,
    budget_remaining: budget - totalCost,
    tickets,
  };
}

// ─── Dispatcher map (for Phase 2 agent loop) ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toolHandlers: Record<string, (params: any) => Promise<unknown>> = {
  get_reference,
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
  calculate_multi_ticket_odds,
};
