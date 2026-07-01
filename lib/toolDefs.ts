import type Anthropic from "@anthropic-ai/sdk";

export const toolDefinitions: Anthropic.Messages.Tool[] = [
  // ─── Retrieval tools ────────────────────────────────────────────────────

  {
    name: "query_games",
    description:
      "List active scratch-off games for a state. Returns game name, number, price, and image URL — identification only, no odds or metrics. Use the metric tools (get_value_metrics, get_outcome_probabilities, get_marginal_odds, get_depletion) to get analytical data for specific games. If the user gives a game name and you're not sure of the exact string, use search_games first to find matches.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          description: "Two-letter state abbreviation (e.g. 'NJ', 'OH')",
        },
        price_tier: {
          type: "number",
          description: "Filter to this ticket price in dollars (e.g. 5, 10, 20)",
        },
        game_id: {
          type: "integer",
          description: "Filter to a specific game by internal ID",
        },
        game_name: {
          type: "string",
          description: "Filter to games matching this exact name",
        },
        game_number: {
          type: "string",
          description: "Filter to a specific game by state-assigned game number",
        },
        sort_by: {
          type: "string",
          enum: ["price_tier", "game_number", "game_name"],
          description: "Column to sort results by. Default: price_tier",
        },
        limit: {
          type: "integer",
          description: "Max games to return (1-200). Default: all active games.",
        },
      },
      required: ["state"],
    },
  },

  {
    name: "get_prizes",
    description:
      "Get the prize structure for one or more games: all prize tiers with labels and dollar values, from the top prize down to losing rows (prize_value = $0). Does not include odds or probabilities — for win/loss probabilities use get_outcome_probabilities, for odds at specific dollar thresholds use get_marginal_odds, for top prize odds use get_top_prizes, and for prize availability use get_depletion. Identify games by game_id/game_ids (from query_games) or by state + game_number/game_numbers. Use game_ids or game_numbers to fetch multiple games in a single call.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_id: {
          type: "integer",
          description: "Single game ID from query_games results",
        },
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description:
            "Multiple game IDs for batch lookup. Use game_id for a single game.",
        },
        state: {
          type: "string",
          description:
            "Two-letter state code, required if using game_number/game_numbers instead of game_id/game_ids",
        },
        game_number: {
          type: "string",
          description:
            "Single state-assigned game number (e.g. '05123'). Must be used with state.",
        },
        game_numbers: {
          type: "array",
          items: { type: "string" },
          description:
            "Multiple state-assigned game numbers for batch lookup. Must be used with state.",
        },
      },
      required: [],
    },
  },

  {
    name: "get_prize_snapshots",
    description:
      "Get historical snapshots of the prize distribution for a game over time. Each snapshot records how many prizes remained at each prize value on a given scrape date. Use this to see how fast prizes are being claimed. Optionally filter to a single prize tier by prize_id.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_id: {
          type: "integer",
          description: "Internal game ID",
        },
        prize_id: {
          type: "integer",
          description: "Filter to a specific prize tier. Omit for all tiers.",
        },
      },
      required: ["game_id"],
    },
  },

  {
    name: "get_freshness",
    description:
      "Check when data was last scraped for a state. Returns the last_scraped_at timestamp. Use this to include a freshness note at the end of responses.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          description: "Two-letter state abbreviation",
        },
      },
      required: ["state"],
    },
  },

  {
    name: "search_games",
    description:
      "Search for games by name or game number. Use this when a user mentions a game and you need to find the exact match. Searches by partial name (case-insensitive) or by game number (exact match).",
    input_schema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          description: "Two-letter state abbreviation",
        },
        query: {
          type: "string",
          description:
            "Partial or full game name to search for (case-insensitive)",
        },
        game_number: {
          type: "string",
          description: "State-assigned game number (exact match)",
        },
      },
      required: ["state"],
    },
  },

  // ─── Metric tools ───────────────────────────────────────────────────────

  {
    name: "get_outcome_probabilities",
    description:
      "Get the probability of losing, breaking even, or winning cash for one or more games. These three probabilities (p_losing, p_breaking_even, p_winning_cash) sum to 1.0. Breaking even includes free tickets and any prize value equal to the ticket cost. This is prize-value agnostic — it tells you the overall chance of each outcome, not the chance of winning a specific amount. Use get_marginal_odds for threshold-specific probabilities. Prize tiers with NULL prize_value are excluded so probabilities sum to 1.0. Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_id: {
          type: "integer",
          description: "Single game ID",
        },
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description:
            "Multiple game IDs for comparison. Use game_id for a single game.",
        },
      },
      required: [],
    },
  },

  {
    name: "get_marginal_odds",
    description:
      "Compute the probability of winning at least a given net-profit threshold for one or more games, calculated from live prize tier data. Net profit = prize value minus ticket cost. A zero at a threshold means no prizes reach that net profit level — use get_prizes to see actual prize tiers.\n\nThreshold behavior:\n- OMIT threshold → computes odds at the standard ladder: $0, $10, $50, $100, $500, $1K, $5K, $10K, $50K, $100K. Always omit for comparisons — this guarantees all games are evaluated at identical thresholds.\n- SINGLE NUMBER → computes odds of winning at least that net-profit amount (e.g. threshold: 1000 for 'chance of profiting $1,000+').\n\nDo NOT pass a custom array of thresholds. For ladder views and game comparisons, always use the default by omitting threshold. Pass all game IDs in a single call so the same threshold applies to every game — comparability is guaranteed by the tool. Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_id: {
          type: "integer",
          description: "Single game ID",
        },
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Multiple game IDs for comparison. Pass all games in one call to ensure same thresholds.",
        },
        threshold: {
          type: "number",
          description: "Single net-profit dollar amount to check (e.g. 1000). Omit for the standard ladder of all default thresholds — always omit when comparing games.",
        },
      },
      required: [],
    },
  },

  {
    name: "get_depletion",
    description:
      "Get prize depletion bands for one or more games: what percentage of prizes remain vs. original supply in three dollar bands (high: $500+, mid: $50-499, low: under $50). NULL when no prizes exist in a given band. Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_id: {
          type: "integer",
          description: "Single game ID",
        },
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Multiple game IDs for comparison",
        },
      },
      required: [],
    },
  },

  {
    name: "get_value_metrics",
    description:
      "Get the overall value of one or more games. Returns value_score (0-100 ranking within the state), ROI, and the reward_raw and risk_raw components that feed into ROI and value_score. Value score is a relative ranking — it compares games against each other within the same state, not against an absolute standard. A high score means better than most other active games; a low score means worse. All scratch-off games have negative expected value, so a high value score does not mean the game is a good deal. Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_id: {
          type: "integer",
          description: "Single game ID",
        },
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Multiple game IDs for comparison",
        },
      },
      required: [],
    },
  },

  {
    name: "get_top_prizes",
    description:
      "Get the top prize (highest prize_value tier) for one or more games, with the computed probability of winning it. Use this when the user asks about top prizes, jackpots, or the biggest payout — it returns the top prize value, its probability, and how many top prizes remain. Probability is computed from prize tier data. Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_id: {
          type: "integer",
          description: "Single game ID",
        },
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Multiple game IDs for comparison",
        },
      },
      required: [],
    },
  },

  // ─── Computation tools ──────────────────────────────────────────────────

  {
    name: "calculate_multi_ticket_odds",
    description:
      "Calculate combined win probability for multi-ticket purchases. Call this whenever you recommend buying more than one ticket — it gives the user the actual combined odds of their purchase. Pure math — requires probabilities as input, does not query the database. First use get_outcome_probabilities or get_marginal_odds to get per-game probabilities, then pass them here. The formula works with any probability type: p_winning_cash for any cash win, mo_50 for winning $50+, etc. — the result means 'probability that at least one ticket hits that threshold.' Accepts multiple ticket groups so you can compare concentration (many tickets of one game) vs. diversification (tickets across different games).",
    input_schema: {
      type: "object" as const,
      properties: {
        tickets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              probability: {
                type: "number",
                description:
                  "Per-ticket probability of the outcome you're calculating for (e.g. p_winning_cash, mo_50). Must be between 0 and 1.",
              },
              count: {
                type: "integer",
                description: "Number of tickets at this probability",
              },
            },
            required: ["probability", "count"],
          },
          description:
            "One entry per distinct probability. For same-game tickets, one entry with count = number of tickets. For different games, one entry per game.",
        },
      },
      required: ["tickets"],
    },
  },

  // ─── Reference lookup ───────────────────────────────────────────────────

  {
    name: "get_reference",
    description:
      "Look up the database schema and metric concepts. Call with no parameters to see the full landscape: all tables, their purposes, and how they relate. Call with a table_name to see field definitions for a specific table. Call with a concept to look up what a specific metric means.",
    input_schema: {
      type: "object" as const,
      properties: {
        table_name: {
          type: "string",
          enum: ["games", "prizes", "prize_snapshots", "game_metrics", "states"],
          description: "Return schema for a specific table",
        },
        concept: {
          type: "string",
          enum: [
            "net_value",
            "outcome_probabilities",
            "marginal_odds",
            "risk",
            "reward",
            "roi",
            "value_score",
            "depletion",
          ],
          description: "Return explanation of a metric concept",
        },
      },
      required: [],
    },
  },
];
