# Plan Changes

| Date | Plan File | Feature | Change | Rationale | Updated |
|------|-----------|---------|--------|-----------|---------|
| 2026-06-26 | `plans/project/phase-1-plan.md` | tools | Removed get_game_detail tool | Was from earlier version; get_prizes and query_games cover the same needs | No |
| 2026-06-26 | `plans/project/phase-1-plan.md` | tools | Added search_games tool with ILIKE partial name matching | Agent needs to find games when user gives approximate names | No |
| 2026-06-26 | `plans/project/phase-1-plan.md` | tools | Added game_id, game_name, game_number filters and overall_odds sort to query_games | Users need to look up specific games, not just browse | No |
| 2026-06-26 | `plans/project/phase-1-plan.md` | tools | Removed state param from get_value_metrics — agent must go through query_games first | Prevents state-level data dumps; keeps traces readable | No |
| 2026-06-26 | `plans/project/phase-1-plan.md` | tools | Renamed get_schema to get_reference | Name better reflects that it covers both schema and metric concepts | No |
| 2026-06-26 | `plans/project/phase-1-plan.md` | tools | Simplified get_depletion to pull stored values only — no fallback computation | Depletion computation belongs in the data pipeline, not agent tools | No |
| 2026-06-29 | `plans/features/phase-3-testing-refinement/phase-3-plan.md` | phase-3 | Added "Discovered Additions" section covering new tools, frontend architecture, and agent behavior improvements | Testing revealed scope beyond original plan — structured response blocks, multi-ticket calculator, recommendation routing | No |
| 2026-06-29 | `project-overview-clean.md` | phase-4 | Phase 4 changed from deferred placeholder to concrete structured response blocks architecture (Pattern 1: structured data → frontend components) | Phase 3 testing proved free-form markdown causes inconsistent formatting and raw data leaking; architectural fix chosen over prompt-based fixes | No |
| 2026-07-03 | `plans/features/phase-4-visualization/implementation-plan.md` | phase-4-visualization | Flipped comparison_table schema: rows are items (games/strategies), columns are metrics | Original games-as-columns design couldn't handle multi-ticket strategy comparisons | Yes |
| 2026-07-03 | `plans/features/phase-4-visualization/implementation-plan.md` | phase-4-visualization | Removed p_losing from odds_chart block; chart reads threshold 0 from marginal_odds instead | Simplifies data flow — agent only needs get_marginal_odds, not get_outcome_probabilities for the chart | Yes |
| 2026-07-03 | `plans/features/phase-4-visualization/implementation-plan.md` | phase-4-visualization | Changed get_marginal_odds to accept array of thresholds instead of single threshold | Agent was making 10 separate calls for odds chart data; one call with all thresholds is cleaner | Yes |
