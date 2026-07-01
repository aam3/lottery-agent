import type Anthropic from "@anthropic-ai/sdk";

export const toolDefinitions: Anthropic.Messages.Tool[] = [
  // ─── Retrieval tools ────────────────────────────────────────────────────

  {
    name: "query_games",
    description:
      "List active scratch-off games for a state. Returns game name, number, price, and image URL — identification only, no odds or metrics. Use metric tools to get analytical data for specific games. If the user gives a game name and you're not sure of the exact string, use search_games first to find matches.",
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
      "The full prize structure for one or more games: all prize tiers with labels and dollar values, from the top prize down to losing rows (prize_value = $0). Does not include odds or probabilities — use metric tools for analytical data. Identify games by game_ids (from query_games) or by state + game_numbers.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description:
            "Game IDs from query_games results. Single game: [42]. Multiple: [42, 43].",
        },
        state: {
          type: "string",
          description:
            "Two-letter state code, required if using game_numbers instead of game_ids",
        },
        game_numbers: {
          type: "array",
          items: { type: "string" },
          description:
            "State-assigned game numbers (e.g. ['05123']). Must be used with state. Use game_ids when possible.",
        },
      },
      required: ["game_ids"],
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
      "Overall probability of losing, breaking even, or winning any cash above $0 for one or more games. Prize-value agnostic — no specific prize goal needed. Use when the user wants general win/loss odds without a dollar target. Does not tell you the chance of winning a specific amount — use get_marginal_odds for that. Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description:
            "Game IDs from query_games. Single game: [42]. Multiple: [42, 43].",
        },
      },
      required: ["game_ids"],
    },
  },

  {
    name: "get_marginal_odds",
    description:
      "Probability of winning at least a specific dollar amount for one or more games. Goal-dependent — requires a dollar target from the user. Use when the user cares about reaching a specific prize level, or wants a detailed view into the prize remaining distribution. A \"large prize\" means net profit >= $500 — when the user says \"big win\" or \"large prize\" without a specific number, use threshold 500. Does not measure general win/loss odds (use get_outcome_probabilities) or the top prize specifically (use get_top_prizes). Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Game IDs from query_games. Pass all games in one call to ensure same thresholds.",
        },
        threshold: {
          type: "number",
          description: "Net-profit dollar amount to check (e.g. 500 for 'chance of profiting $500+').",
        },
      },
      required: ["game_ids", "threshold"],
    },
  },

  {
    name: "get_depletion",
    description:
      "How much of a game's prize pool has been claimed, in three dollar bands (high: $500+, mid: $50-499, low: under $50). Supplementary context, not a decision driver — probabilities should always guide recommendations, but depletion shows whether a game's prizes are well-stocked or picked over. Particularly relevant when the user cares about large or top prizes, since older, more depleted games have fewer remaining. NULL when no prizes exist in a given band. Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Game IDs from query_games. Single game: [42]. Multiple: [42, 43].",
        },
      },
      required: ["game_ids"],
    },
  },

  {
    name: "get_risk_reward",
    description:
      "How much a player stands to gain per win vs. lose per loss on a game — the risk-reward profile. Also returns ROI: net expected outcome per dollar spent, which allows comparison across price points. Meaningful for any game, no user goal required. Use when the user wants to know which game offers the best overall return for the money. Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Game IDs from query_games. Single game: [42]. Multiple: [42, 43].",
        },
      },
      required: ["game_ids"],
    },
  },

  {
    name: "get_top_prizes",
    description:
      "The top prize (highest prize tier) for one or more games and the probability of winning it. Goal-dependent — only relevant when the user is asking about top prizes, jackpots, or the biggest possible payout. Does not measure the chance of winning above a general dollar threshold — use get_marginal_odds for that. Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Game IDs from query_games. Single game: [42]. Multiple: [42, 43].",
        },
      },
      required: ["game_ids"],
    },
  },

  // ─── Computation tools ──────────────────────────────────────────────────

  {
    name: "calculate_multi_ticket_odds",
    description:
      "Combined win probability for multi-ticket purchases within a budget. Goal-dependent — requires a budget the user has specified. Use to evaluate whether buying multiple tickets is better than a single more expensive one. Pure math — requires probabilities as input, does not query the database. First use get_outcome_probabilities or get_marginal_odds to get per-game probabilities, then pass them here. The result means \"probability that at least one ticket hits that threshold.\" Accepts multiple ticket groups so you can compare concentration (many tickets of one game) vs. diversification (tickets across different games).",
    input_schema: {
      type: "object" as const,
      properties: {
        budget: {
          type: "number",
          description:
            "Total dollars the user wants to spend. The tool validates that the ticket selections don't exceed this amount.",
        },
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
              price_per_ticket: {
                type: "number",
                description:
                  "Ticket price in dollars (price_tier from query_games).",
              },
            },
            required: ["probability", "count", "price_per_ticket"],
          },
          description:
            "One entry per distinct probability. For same-game tickets, one entry with count = number of tickets. For different games, one entry per game.",
        },
      },
      required: ["budget", "tickets"],
    },
  },

];
