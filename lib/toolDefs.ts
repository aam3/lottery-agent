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
      "Check when data was last scraped for a state. Returns the last_scraped_at timestamp.",
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
      "Per-ticket probability of losing, breaking even (prize equals ticket price), or winning cash above $0. No specific prize goal needed. Does not measure total spend recovery or the chance of winning a specific amount — use get_marginal_odds for that. Requires game IDs from query_games.",
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
      "Probability of winning at least a specific dollar amount for one or more games. Goal-dependent — requires a dollar target from the user. Use when the user cares about reaching a specific prize level. Does not measure general win/loss odds (use get_outcome_probabilities) or the top prize specifically (use get_top_prizes). Requires game IDs from query_games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Game IDs from query_games. Pass all games in one call to ensure same thresholds.",
        },
        thresholds: {
          type: "array",
          items: { type: "number" },
          description: "Dollar amounts the user wants to win (net profit after ticket cost). Derived from the user's prize goal. Single: [50]. Broad scan: [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000].",
        },
      },
      required: ["game_ids", "thresholds"],
    },
  },

  {
    name: "get_depletion",
    description:
      "How much of a game's prize pool has been claimed, in three dollar bands (high: $500+, mid: $50-499, low: under $50). Shows whether a game's prizes are well-stocked or picked over. NULL when no prizes exist in a given band. Requires game IDs from query_games.",
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

  // ─── Recommendation tool ──────────────────────────────────────────────────

  {
    name: "optimize_multi_ticket_bundle",
    description:
      "The only way to determine how many tickets to buy of each game. Given a budget, goal, and risk tolerance, computes the optimal bundle — which games and how many of each — using convolution math that per-ticket odds cannot replicate. Do not call until the user has stated their budget, prize goal, and risk tolerance. Without this tool, you can recommend individual games based on their metrics, but you cannot determine ticket quantities or construct multi-game bundles. Use your analysis tools to narrow game candidates before passing them here. Returns the recommended bundle, P(reach goal), P(win anything), and a plain-English explanation.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description:
            "Game IDs selected based on metrics relevant to the user's goal — use marginal odds at the goal threshold for dollar goals, outcome probabilities for 'win anything' goals, or top prize odds for top-prize goals.",
        },
        budget: {
          type: "number",
          description: "Maximum dollars the user wants to spend on tickets.",
        },
        goal: {
          type: "number",
          description:
            "Dollar amount the user wants to win. 0 = 'win anything.' 'Break even' or 'win my money back' = goal is their budget, not 0.",
        },
        risk: {
          type: "string",
          enum: ["low", "mid", "high"],
          description:
            "The user's risk tolerance: low, mid, or high. Cannot be inferred from budget or goal — must be asked directly. Exception: if the user's goal is to win any cash (goal = 0), risk is low by definition.",
        },
      },
      required: ["game_ids", "budget", "goal", "risk"],
    },
  },

  {
    name: "probe_budget_for_goal",
    description:
      "Estimates what budget would give a realistic shot at a dollar goal. Use after optimize_multi_ticket_bundle returns an unreachable goal — tells the user how much more they'd need to spend. Pass the same game_ids used in the original recommendation.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Same game IDs from the optimize_multi_ticket_bundle call.",
        },
        goal: {
          type: "number",
          description: "The dollar goal that was unreachable.",
        },
        budget: {
          type: "number",
          description: "The user's current budget. Probe searches upward from here.",
        },
      },
      required: ["game_ids", "goal", "budget"],
    },
  },

  // ─── Explore tools ──────────────────────────────────────────────────────

  {
    name: "build_game_card",
    description:
      "Compact summary card for a game — game name, image, and key metrics (Price, Top Prize, Win Rate, ROI). Use when presenting a game recommendation in conversation. The card includes an Explore link so the user can view detailed visuals on the dashboard. Does NOT return charts or visualizations — those are on the dashboard.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_id: {
          type: "integer",
          description: "Internal game ID from a prior recommendation result or query_games.",
        },
        state: {
          type: "string",
          description: "Two-letter state abbreviation. Use with game_number as an alternative to game_id.",
        },
        game_number: {
          type: "string",
          description: "State-assigned game number (e.g. '01973'). Use with state as an alternative to game_id.",
        },
      },
      required: [],
    },
  },

  // ─── Response formatting ─────────────────────────────────────────────────

  {
    name: "render_response",
    description:
      "Format the final response for the user. Call as the last step after gathering all data needed to answer the question.",
    input_schema: {
      type: "object" as const,
      properties: {
        blocks: {
          type: "array",
          description: "Ordered list of content blocks to display.",
          items: {
            type: "object",
            oneOf: [
              {
                title: "text",
                description:
                  "Conversational text in markdown. This is the only block where you speak directly to the user — use it for explanations, recommendations, caveats, and framing. Always include at least one text block so the response feels like a conversation, not just data.",
                properties: {
                  type: { type: "string", const: "text" },
                  content: {
                    type: "string",
                    description: "Markdown-formatted text.",
                  },
                },
                required: ["type", "content"],
                additionalProperties: false,
              },
              {
                title: "game_stats_summary",
                description:
                  "A single game's key metrics displayed as a horizontal row with an image. Metrics are whichever values support the recommendation or requested game summary — you choose which to include and pre-format each as a label/value pair. Use when presenting one game's profile after a lookup or as part of a recommendation. Do NOT use for comparing multiple games side-by-side — use comparison_table for that.",
                properties: {
                  type: { type: "string", const: "game_stats_summary" },
                  game_id: {
                    type: "integer",
                    description: "Internal game ID from query_games. Required for the Explore link to work.",
                  },
                  game_name: { type: "string" },
                  game_number: { type: "string" },
                  image_url: {
                    type: ["string", "null"],
                    description: "Game image URL from query_games, or null.",
                  },
                  metrics: {
                    type: "array",
                    description:
                      "Pre-formatted metric entries, max 4. Labels containing 'rank' are auto-accented.",
                    maxItems: 4,
                    items: {
                      type: "object",
                      properties: {
                        label: {
                          type: "string",
                          description: "Metric name shown as the header (e.g. 'Top Prize', 'Price Rank').",
                        },
                        value: {
                          type: "string",
                          description: "Formatted display value (e.g. '$500K', '1 in 3.1', '#2 of 14').",
                        },
                        suffix: {
                          type: "string",
                          description: "Optional secondary text shown after the value (e.g. '(3 left)').",
                        },
                      },
                      required: ["label", "value"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["type", "game_id", "game_name", "game_number", "image_url", "metrics"],
                additionalProperties: false,
              },
              {
                title: "comparison_table",
                description:
                  "Table comparing 2+ items side-by-side. Rows are the items being compared (games, ticket strategies, bundles), columns are metrics. Use when comparing games, presenting ranked options, or comparing multi-ticket strategies — the metrics you include should support the comparison the user is asking about. Do NOT use for a single game — use game_stats_summary instead.",
                properties: {
                  type: { type: "string", const: "comparison_table" },
                  columns: {
                    type: "array",
                    description: "Metric column headers only — max 3. The first column (game name with price pill) and last column (Explore link) are generated automatically, so do NOT include them. Do NOT include a Price column — the ticket price is already shown as a pill next to the game name. Example: [{label:'Top Prize'}, {label:'Win Rate'}, {label:'ROI'}].",
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                      },
                      required: ["label"],
                      additionalProperties: false,
                    },
                  },
                  rows: {
                    type: "array",
                    description: "Items being compared. Each row has a label (game name or strategy description), optional price_tier for a price pill, and one value per column.",
                    minItems: 2,
                    items: {
                      type: "object",
                      properties: {
                        label: {
                          type: "string",
                          description: "Row label — game name with number (e.g. 'Gold Rush (#1501)') or strategy (e.g. '9× Super Crossword ($5)').",
                        },
                        price_tier: {
                          type: "number",
                          description: "Ticket price for price pill display. Omit for mixed-price strategies.",
                        },
                        values: {
                          type: "array",
                          items: { type: "string" },
                          description: "One formatted value per column, same order as columns array. Must have exactly as many values as there are columns.",
                        },
                      },
                      required: ["label", "values"],
                      additionalProperties: false,
                    },
                  },
                  game_ids: {
                    type: "array",
                    items: { type: "integer" },
                    description: "Game IDs of the compared games, one per row in the same order as rows. Include when rows are individual games so each row gets an Explore link.",
                  },
                },
                required: ["type", "columns", "rows"],
                additionalProperties: false,
              },
              {
                title: "choices",
                description:
                  "Multiple-choice question for the user. Renders as clickable buttons. Use for preference questions like prize goal and risk tolerance. Always include 'Something else' as the last option.",
                properties: {
                  type: { type: "string", const: "choices" },
                  prompt: {
                    type: "string",
                    description: "The question being asked.",
                  },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "Choice labels. Last item should be 'Something else'.",
                  },
                },
                required: ["type", "prompt", "options"],
                additionalProperties: false,
              },
              {
                title: "explore_options",
                description:
                  "Horizontal clickable suggestion pills for navigating within an explore view. Auto-generated by explore tools — do NOT construct this block manually.",
                properties: {
                  type: { type: "string", const: "explore_options" },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    description: "Suggestion labels. Each renders as a clickable pill.",
                  },
                },
                required: ["type", "options"],
                additionalProperties: false,
              },
            ],
          },
        },
      },
      required: ["blocks"],
    },
  },
];
