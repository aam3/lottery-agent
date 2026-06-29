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
      roi: "Return on investment: (reward_raw - risk_raw) / price_tier. Negative means net loss.",
      value_score: "ROI normalized 0-100 via min-max across all active games in same state",
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
    definition: "Probability of winning at least a given net-profit threshold on a single ticket.",
    thresholds: [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000],
    usage: "Lets users compare realistic win chances at specific dollar levels. A conservative player focuses on mo_0 (any win), a risk-tolerant player focuses on mo_500 or mo_1000.",
    interpretation: "Flat values across thresholds mean all wins exceed the lower threshold. A zero means no prizes reach that net profit level — but prize tiers may still exist in that dollar range (e.g., a $400 prize on a $20 ticket has $380 net profit, which is above mo_100 but below mo_500). Do not infer prize structure from marginal odds — use get_prizes for that.",
  },
  risk: {
    definition: "Average net loss per losing ticket (where net value < 0).",
    interpretation: "Describes only the loss side of the prize distribution. Should not be presented on its own — it only tells half the story. Use relative to reward, or through the combined measures ROI and value_score.",
  },
  reward: {
    definition: "Average net gain per winning ticket (where net value > 0).",
    interpretation: "Describes only the reward side of the prize distribution. Should not be presented on its own — it only tells half the story. Use relative to risk, or through the combined measures ROI and value_score.",
  },
  roi: {
    definition: "(reward_raw - risk_raw) / price_tier. Net expected outcome per dollar spent.",
    interpretation: "Negative means net loss (which is typical for lottery games). Expresses how much of each dollar spent is expected back in prizes.",
  },
  value_score: {
    definition: "ROI normalized to 0-100 across all active games in the same state using min-max scaling.",
    interpretation: "A relative ranking — compares games against each other within the same state, not against an absolute standard. A score of 100 means the best ROI in the state, 0 means the worst. All scratch-off games have negative expected value, so a high value score does not mean the game is a good deal. This is NOT a percentile — a score of 30 does not mean 'better than 30% of games.' It means the game's ROI is 30% of the way between the worst and best ROI in the state.",
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
  game_id?: number;
  state?: string;
  game_number?: string;
}) {
  const { game_id, state, game_number } = params;

  try {
    let rows;
    if (game_id !== undefined) {
      rows = await sql`
        SELECT p.prize_id, p.game_id, p.prize_label, p.prize_value,
               p.prize_odds, p.is_free_ticket, p.scrape_date,
               g.game_name, g.game_number, g.price_tier, g.state, g.image_url
        FROM prizes p
        JOIN games g ON g.game_id = p.game_id
        WHERE p.game_id = ${game_id}
        ORDER BY p.prize_value DESC NULLS LAST
      `;
    } else if (state && game_number) {
      rows = await sql`
        SELECT p.prize_id, p.game_id, p.prize_label, p.prize_value,
               p.prize_odds, p.is_free_ticket, p.scrape_date,
               g.game_name, g.game_number, g.price_tier, g.state, g.image_url
        FROM prizes p
        JOIN games g ON g.game_id = p.game_id
        WHERE g.state = ${state.toUpperCase()} AND g.game_number = ${game_number}
        ORDER BY p.prize_value DESC NULLS LAST
      `;
    } else {
      return { error: "Provide game_id, or both state and game_number." };
    }

    if (rows.length === 0) {
      return { error: "No prizes found for the specified game." };
    }

    return {
      game_id: rows[0].game_id,
      game_name: rows[0].game_name,
      game_number: rows[0].game_number,
      price_tier: rows[0].price_tier,
      state: rows[0].state,
      image_url: rows[0].image_url,
      prizes: rows.map((r: Record<string, unknown>) => ({
        prize_id: r.prize_id,
        prize_label: r.prize_label,
        prize_value: r.prize_value,
        prize_odds: r.prize_odds,
        is_free_ticket: r.is_free_ticket,
        scrape_date: r.scrape_date,
      })),
    };
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

function normalizeIds(params: { game_id?: number; game_ids?: number[] }): number[] | null {
  const ids = params.game_ids ?? (params.game_id ? [params.game_id] : []);
  return ids.length > 0 ? ids : null;
}

export async function get_outcome_probabilities(params: {
  game_id?: number;
  game_ids?: number[];
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
  game_id?: number;
  game_ids?: number[];
}) {
  const ids = normalizeIds(params);
  if (!ids) return { error: "Provide game_id or game_ids." };

  try {
    const rows = await sql`
      SELECT gm.game_id, g.game_name, g.game_number, g.price_tier, g.state,
             gm.mo_0, gm.mo_10, gm.mo_50, gm.mo_100, gm.mo_500,
             gm.mo_1000, gm.mo_5000, gm.mo_10000, gm.mo_50000, gm.mo_100000,
             gm.computed_at
      FROM game_metrics gm
      JOIN games g ON g.game_id = gm.game_id
      WHERE gm.game_id = ANY(${ids})
    `;
    return { metrics: rows };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
}

export async function get_depletion(params: {
  game_id?: number;
  game_ids?: number[];
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

export async function get_value_metrics(params: {
  game_id?: number;
  game_ids?: number[];
}) {
  const ids = normalizeIds(params);
  if (!ids) return { error: "Provide game_id or game_ids." };

  try {
    const rows = await sql`
      SELECT gm.game_id, g.game_name, g.game_number, g.price_tier, g.state, g.image_url,
             gm.value_score, gm.roi, gm.reward_raw, gm.risk_raw, gm.computed_at
      FROM game_metrics gm
      JOIN games g ON g.game_id = gm.game_id
      WHERE gm.game_id = ANY(${ids})
      ORDER BY gm.value_score DESC NULLS LAST
    `;
    return { metrics: rows };
  } catch (err) {
    return { error: `Database error: ${(err as Error).message}` };
  }
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
  get_value_metrics,
};
