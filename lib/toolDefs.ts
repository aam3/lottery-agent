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
      "Probability of winning at least a specific dollar amount for one or more games. Goal-dependent — requires a dollar target from the user. Use when the user cares about reaching a specific prize level, or wants a detailed view into the prize remaining distribution. Does not measure general win/loss odds (use get_outcome_probabilities) or the top prize specifically (use get_top_prizes). Requires game IDs from query_games.",
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
          description: "Net-profit dollar amounts to check. Single: [500]. Multiple: [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000].",
        },
      },
      required: ["game_ids", "thresholds"],
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

  // ─── Recommendation tool ──────────────────────────────────────────────────

  {
    name: "optimize_multi_ticket_bundle",
    description:
      "The only way to determine how many tickets to buy of each game. Given a budget, goal, and risk tolerance, computes the optimal bundle — which games and how many of each — using convolution math that per-ticket odds cannot replicate. Without this tool, you can recommend individual games based on their metrics, but you cannot determine ticket quantities or construct multi-game bundles. Use your analysis tools to narrow game candidates before passing them here. Returns the recommended bundle, P(reach goal), P(win anything), and a plain-English explanation.",
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
            "Determines the bundle composition. Different risk levels produce different game selections and ticket quantities — low favors games with high win rates, high concentrates on games with the best goal probability regardless of win rate. Must come from the user, not inferred — there is no neutral default.",
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
                required: ["type", "game_name", "game_number", "image_url", "metrics"],
                additionalProperties: false,
              },
              {
                title: "odds_chart",
                description:
                  "Line chart showing the probability of winning at least each dollar amount for 1–4 games. Use when summarizing the prize distribution of a game or comparing prize distributions across games. Requires marginal odds from get_marginal_odds at multiple dollar amounts; default thresholds are [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000]. The chart has hover tooltips — do not list the same probabilities in text. Do NOT use to answer general odds questions (e.g. 'what are my chances of winning') — use text with outcome probabilities for that. Do NOT use for a single probability at one threshold — state that in text instead.",
                properties: {
                  type: { type: "string", const: "odds_chart" },
                  games: {
                    type: "array",
                    description: "1–4 games. Each needs marginal odds from get_marginal_odds at multiple thresholds.",
                    minItems: 1,
                    maxItems: 4,
                    items: {
                      type: "object",
                      properties: {
                        game_name: { type: "string" },
                        game_number: { type: "string" },
                        price_tier: { type: "number" },
                        top_prize_value: {
                          type: "number",
                          description: "Top prize value. Used to cap thresholds in single-game mode.",
                        },
                        marginal_odds: {
                          type: "object",
                          description:
                            "Map of dollar threshold (as string key) to probability. Keys: '0', '10', '50', '100', '500', '1000', '5000', '10000', '50000', '100000'. Values from get_marginal_odds.",
                          additionalProperties: { type: "number" },
                        },
                      },
                      required: ["game_name", "game_number", "price_tier", "top_prize_value", "marginal_odds"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["type", "games"],
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
                    description: "Metric column headers only — the first column (item/game name) is generated automatically from row labels, so do NOT include it here. Example: [{label:'Top Prize'}, {label:'Overall Odds'}].",
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
                title: "depletion_bars",
                description:
                  "Three horizontal bars showing what percentage of prizes remain in high ($500+), mid ($50–$499), and low (under $50) bands for a single game. Data comes from get_depletion. Use when the user asks about prize availability or how much of a game's prize pool has been claimed — particularly relevant when the user cares about large prizes. One game per block — do NOT combine multiple games.",
                properties: {
                  type: { type: "string", const: "depletion_bars" },
                  game_name: { type: "string" },
                  game_number: { type: "string" },
                  bands: {
                    type: "array",
                    description: "Three bands: High, Mid, Low.",
                    minItems: 1,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        name: {
                          type: "string",
                          description: "Band label: 'High', 'Mid', or 'Low'.",
                        },
                        range: {
                          type: "string",
                          description: "Dollar range description (e.g. '$500+', '$50 – $499', 'Under $50').",
                        },
                        pct: {
                          type: "number",
                          description: "Percentage of prizes remaining in this band (0–100).",
                        },
                      },
                      required: ["name", "range", "pct"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["type", "game_name", "game_number", "bands"],
                additionalProperties: false,
              },
              {
                title: "risk_reward_scatter",
                description:
                  "Bubble chart plotting risk vs. reward for 2+ games across price tiers. Bubble size = avg cash prize, color = price tier. Data comes from get_risk_reward. ONLY use when games span multiple price tiers — the chart illustrates that higher-priced tickets carry more risk but offer higher potential reward. Games at the same price tier have identical risk, producing a useless vertical line. When all games share one price tier, use comparison_table instead. Do NOT use for a single game — describe risk/reward in text instead.",
                properties: {
                  type: { type: "string", const: "risk_reward_scatter" },
                  games: {
                    type: "array",
                    description: "Games to plot. Need at least 2 for a meaningful scatter.",
                    minItems: 2,
                    items: {
                      type: "object",
                      properties: {
                        game_name: { type: "string" },
                        game_number: { type: "string" },
                        price_tier: { type: "number" },
                        risk_scaled: {
                          type: "number",
                          description: "Risk score (0–10 scale) from get_risk_reward.",
                        },
                        reward_scaled: {
                          type: "number",
                          description: "Reward score (0–10 scale) from get_risk_reward.",
                        },
                        avg_cash_prize: {
                          type: "number",
                          description: "Average cash prize in dollars. Drives bubble size.",
                        },
                        top_prize_value: {
                          type: "number",
                          description: "Top prize value for tooltip display.",
                        },
                      },
                      required: ["game_name", "game_number", "price_tier", "risk_scaled", "reward_scaled", "avg_cash_prize", "top_prize_value"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["type", "games"],
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
