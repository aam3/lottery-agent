# Project Status

## Session 1 — 2026-07-26 [build-recommendation-tool]
Tested and refined the recommendation tool integration through live chat UI. Fixed agent conversation flow: tool description gating prevents premature bundling and risk inference (no system prompt rules needed). Added clickable choices block for multiple-choice questions. Clarified break-even semantics across tools. Ran Phase 5 calibration against real NJ data (90 combos) — risk floors validated, diversity factor designed and implemented (D=2, log-scaled per-price-tier cap), budgetProbe extracted into separate tool for 6-41x performance improvement on escalation cases. 12 edge case tests passing.
- **Key areas:** `lib/recommender.ts`, `lib/toolDefs.ts`, `lib/tools.ts`, `lib/systemPrompt.ts`, `components/blocks/ChoicesBlock.tsx`

## Session 1 — 2026-07-05 [build-recommendation-tool]
Created the `optimize_multi_ticket_bundle` tool — a recommendation engine with internal router dispatching to three methods: coverage (win anything), single-hit (moonshot), and full search (beam search over capped convolution DP with Pareto frontier and risk-floor selection). Fixed `get_marginal_odds` to use `prizes_remaining` denominator. Removed `calculate_multi_ticket_odds` (redundant). Switched all probability calculations to net values (prize - cost). Extensively revised system prompt: refined agent identity to be tool-driven, rewrote "How Players Think" and risk tolerance sections to establish budget → goal → risk progression, tightened reasoning protocol. Iterative tool description refinement to guide agent toward correct question sequencing.
- **Key areas:** `lib/recommender.ts`, `lib/tools.ts`, `lib/toolDefs.ts`, `lib/systemPrompt.ts`, `plans/features/build-recommendation-tool/plan.md`

## Session 1 — 2026-07-03 [phase-4-visualization]
Implemented Phase 4 visualization end-to-end: design tokens, 8 block components, `render_response` tool with oneOf schema, agent loop integration, and frontend rendering. Collaboratively reviewed all block type descriptions against tool-description-guidance framework. Extensive UI testing and polish — fixed text spacing, freshness note styling, game stats summary layout (image spanning name + metrics), comparison table flip (rows=items, columns=metrics), strategy label formatting with price pills and quantity highlighting, odds chart legend stacking, and dynamic price color assignment. Changed `get_marginal_odds` to accept array of thresholds.
- **Key areas:** `components/blocks/`, `lib/toolDefs.ts`, `lib/tokens.ts`, `lib/chartUtils.tsx`, `app/page.tsx`, `lib/systemPrompt.ts`

## Session 1 — 2026-06-29 [phase-3-testing-refinement]
Built trace logging infrastructure and test question set, then ran 7 batches of systematic testing. Restructured system prompt (identity with role boundary, guiding principles, hard rules). Refined tool descriptions and response data to fix raw data leaking, value score misinterpretation, cross-state comparisons, and unsupported claims. Stripped analytical fields from lookup tools to force proper tool chaining. Documented Phase 4 structured response blocks architecture decision.
- **Key areas:** `lib/systemPrompt.ts`, `lib/toolDefs.ts`, `lib/tools.ts`, `lib/traceLogger.ts`, `tests/test-questions.md`

## Session 2 — 2026-06-26 [phase-2-agent-loop]
Implemented Phase 2: agent loop, API route, and chat frontend. Built the tool-use loop (`agentLoop.ts`) with prompt caching, iteration cap, and usage tracking. Replaced API route stub with POST handler including input validation and typed SDK error handling. Built minimal chat UI with state selector, collapsible tool trace, usage badges, and markdown rendering with inline ticket images. Verified end-to-end with live API calls — confirmed cache hits, multi-tool reasoning paths, and proper response formatting.
- **Key areas:** `lib/agentLoop.ts`, `app/api/chat/route.ts`, `app/page.tsx`, `app/globals.css`

## Session 1 — 2026-06-26 []
Set up project infrastructure (Phase 0) and built all tool functions, definitions, and system prompt (Phase 1). Initialized Next.js App Router with Neon and Anthropic SDK clients. Designed and implemented 10 agent tools through iterative review — retrieval tools (query_games, search_games, get_prizes, get_prize_snapshots, get_freshness), metric tools (get_outcome_probabilities, get_marginal_odds, get_depletion, get_value_metrics), and a reference lookup tool (get_reference). Assembled system prompt from domain knowledge and response guidelines. Set up CLAUDE.md and project primer.
- **Key areas:** `lib/tools.ts`, `lib/toolDefs.ts`, `lib/systemPrompt.ts`, `lib/db.ts`, `CLAUDE.md`
