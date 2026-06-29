# Test Feedback Log

Observations from each test batch, with action items.

---

## Batch 1: Basic Retrieval (2026-06-29)

### Q1: "What $5 games are available?" (NJ)
- Agent returned names and images for every game — no summarization
- **Action:** Deferred to visualization phase — needs styled output rendering with automatic formatting

### Q2: "Tell me about the Cash Blast game" / "Tell me about the Cash Fever game" (NJ)
- Cash Blast: correctly reported no match
- Cash Fever: returned outcome probabilities but percentages did not sum to 1 — investigate if this is a backend data issue or agent presentation issue
- Phrasing was negative/deterring: "About 3 in 4 tickets lose outright, and your chance of winning anything substantial is slim." Tone should be objective, not discouraging. Some people just want to buy tickets.
- **Action:** Investigate probability sum issue. Adjust system prompt tone — be objective about odds, not negative.

### Q3: "Show me the prizes for game number 1839" / alternate game (NJ)
- Game 1839 not found, retried with a different number
- Response format was inconsistent with Q2 — different structure and description style
- **Leaked raw prize data** (remaining counts) — hard rule violation
- **Action:** Inconsistent formats → future phase (response templates/skills). Raw data leak → strengthen guardrail. Reinforce that raw numbers should be converted to percentages and statistics.

### Q3 (re-test): "Show me the prizes for game number 01962" (NJ)
- Raw prize counts no longer showing — fix confirmed (stripped from tool response)

### Q4: "When was the data last updated?" (NJ)
- No issues noted.

---

## Batch 2: Comparisons (2026-06-29)

### Q1: "Which $10 game has the best odds of winning anything?" (NJ)
- No issues.

### Q2: "Compare Cash Fever and Loose Change Jackpot" (NJ)
- Good response. Agent claimed value score 30 = "better than 70% of NJ games" — value_score is min-max normalized ROI, not a percentile. Agent is still misinterpreting the score as a percentile ranking.
- **Action:** May need to clarify in reference concept that value_score is NOT a percentile.

### Q3: "What's the best value $20 game?" (NJ)
- No issues. Follow-up "What about for winning at least $50?" produced good analysis but agent inferred prize structure from marginal odds ("zero prizes between $100 and top tier") without calling get_prizes.
- **Action:** Fixed — updated marginal odds tool description and reference concept to distinguish probability thresholds from prize structure.

---

## Batch 3: Recommendations (2026-06-29)

### Q1: "I have $10 to spend, what should I buy?" (NJ)
- No issues.

### Q2: "I want the game where I'm most likely to win something, even if it's small. Budget is $5." (NJ)
- No issues.

### Q3: "I want the best shot at winning $1,000 or more. I'll spend up to $20." (NJ)
- Double query_games call — second call redundantly re-queried the recommended game. Agent should have had all needed game_ids from the first call.
- **Action:** Minor inefficiency, not blocking. Monitor if this pattern persists.

### Q4: "Just tell me what to buy." (NJ)
- Agent claimed Neon Cash Party's value score of 57 was "the highest in New Jersey right now." Incorrect — value_score is min-max so there should be a game at 100. Root cause: query_games limit of 25 meant agent only saw a subset of games.
- **Action:** Fixed — default limit raised to 200. Re-test confirmed the fix works.

### Q5: "I don't want to lose, but I'd love a shot at something big. Budget is $10." (NJ)
- Reasoning was solid — correctly identified tension between competing goals, compared across dimensions, disclosed tradeoffs. Tone leans slightly editorial ("no break-even nonsense", "fake wins") but analytical reasoning was strong.

### Q6: Multi-turn funnel (OH)
- Turn 1 "What's good in Ohio?" — agent recommended $5 games as best but missed $20 game with value_score 100. Root cause: query_games limit of 50 sorted by price_tier cut off higher-tier games.
- Turn 2 "Only got $10" — correctly narrowed. Turn 3 "Honestly, I'd love to win something real" — correctly refined.
- **Action:** Fixed — same limit fix as Q4.

---

## Batch 5: Edge Cases (2026-06-29)

### Q1: "Tell me about the Super Mega Jackpot Blaster game" (NJ)
- No issues.

### Q2: "Tell me about Crossword" (NJ)
- No issues.

### Q3: "What are the Powerball numbers for tonight?" (NJ)
- Agent correctly stayed in scope. Interesting response about value per dollar across price points — the $3 Crossword delivers more value per dollar than the $30 version despite worse raw odds.
- **Future investigation:** Is there a metric that captures relative probability gain vs. price increase? Or is value_score already that metric (since it normalizes ROI by price)? Worth exploring whether additional price-efficiency metrics are needed.

### Q4: "What's good?" (NJ)
- No issues. Agent did not prompt for budget or prize goals.
- **Future improvement:** Agent should be more conversational — probing for budget, prize goals, risk tolerance when queries are vague. Needs recommendation routing logic that makes the decision framework clearer.

---

## Batch 7: Guardrail Tests (2026-06-29)

### Q1: "Which game has the biggest top prize?" (NJ)
- Warning tone too strong/preachy: "Before you chase that headline number..." Agent should answer the question objectively and include odds context, not lecture.
- **Action:** Ties to tone adjustment — "be objective" principle already updated, but agent still editorializes. May need few-shot examples of neutral tone.

### Q2: "I want to spend $200 today, what's the best strategy?" (NJ)
- Agent claimed "$20 ticket has roughly 10x the expected return of a $1 ticket" without showing actual numbers. May have been using reward_raw/risk_raw to derive this.
- **Action:** Fixed — added hard rule "EVERY CLAIM NEEDS DATA."

### Q3: "Which state has the best games?" (NJ)
- **Agent queried all five states and provided a cross-state comparison.** Major violation — metrics are relative within a state and not comparable across states.
- Re-test: fixed. Agent now explains limitation concisely.
- **Action:** Fixed — added hard rule "NO CROSS-STATE COMPARISONS." Also moved succinctness to identity section to reduce verbosity.

### Q4: "Which game has the highest reward?" (NJ)
- Response contained no numbers at all. Just said "highest reward" and "strongest upside potential" without data.
- **Action:** Fixed — same hard rule "EVERY CLAIM NEEDS DATA."

---

## Deferred to End of Phase 3

- **Single game report tool** — A formatting guide/tool for returning single game information in a consistent, styled way. Agent needs structured guidance on how to present a game report (prize tiers, metrics, analysis) so output is consistent across queries.
- **Multi-game comparison tool** — Components that help the agent compare multiple games on single plots/visualizations. Needed for scenarios where a user wants to compare 2-3 games side by side.
- **Structured response blocks architecture** — Move from free-form markdown to typed content blocks (game_card, odds_chart, metric_summary, text) with pre-built React components. Solves formatting consistency and raw data leaking structurally. This is a separate phase.
- **Price-efficiency metric** — Investigate whether value_score already captures "probability gain per dollar" or if an additional metric is needed to compare across price tiers.
- **Conversational probing** — Agent should ask follow-up questions about budget, prize goals, and risk tolerance when queries are vague. Currently jumps straight to analysis.
- **Recommendation routing** — Explicit decision framework for how the agent reasons through recommendations. Makes the logic clearer and more consistent across different recommendation journeys.
