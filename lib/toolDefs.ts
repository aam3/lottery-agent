import type Anthropic from "@anthropic-ai/sdk";

export const toolDefinitions: Anthropic.Messages.Tool[] = [
  // ─── Retrieval tools ────────────────────────────────────────────────────

  {
    name: "query_games",
    description:
      "List active scratch-off games for a state. Returns game name, number, price, overall odds, and image URL. Filter by price tier, game ID, game name, or game number. Sort by price, game number, name, or overall odds. Does NOT include computed metrics — use the metric tools (get_value_metrics, get_outcome_probabilities, get_marginal_odds, get_depletion) to get analysis for specific games. If the user gives a game name and you're not sure of the exact string, use search_games first to find matches.",
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
          enum: ["price_tier", "game_number", "game_name", "overall_odds"],
          description: "Column to sort results by. Default: price_tier",
        },
        limit: {
          type: "integer",
          description: "Max games to return (1-50). Default: 25",
        },
      },
      required: ["state"],
    },
  },

  {
    name: "get_prizes",
    description:
      "Get the prize distribution for a specific game: how many prizes remain at each prize value. Shows every prize tier from the top prize down to losing rows (prize_value = $0). Identify the game by game_id (from query_games) or by state + game_number.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_id: {
          type: "integer",
          description: "Internal game ID from query_games results",
        },
        state: {
          type: "string",
          description:
            "Two-letter state code, required if using game_number instead of game_id",
        },
        game_number: {
          type: "string",
          description:
            "State-assigned game number (e.g. '05123'). Must be used with state.",
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
      "Get the probability of winning at least a given net-profit threshold for one or more games. Thresholds: $0 (any profit), $10, $50, $100, $500, $1K, $5K, $10K, $50K, $100K. Net profit = prize minus ticket cost. Use this to compare realistic win chances across games at specific dollar levels. Requires game IDs from query_games.",
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
      "Get the overall value of one or more games. Returns value_score (0-100 ranking within the state), ROI, average reward per winning ticket, and average risk per losing ticket. Value score measures how favorable a game is based on its potential reward and potential risk, taking ticket price into account. Requires game IDs from query_games.",
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
