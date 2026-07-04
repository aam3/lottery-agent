# Project: Lottery Scratcher Agent

## Overview
A locally-run chat agent that answers questions about scratch-off lottery games across five U.S. states (NJ, CA, FL, NY, OH). Queries a Neon PostgreSQL database populated by an existing scraper, provides probability/statistics analysis, game comparisons, and recommendations for non-technical lottery players. Built as an MVP and learning exercise in structuring domain knowledge and tools for tool-using LLM agents — the domain is deliberately small so the patterns transfer to larger projects.

## Current State
Phases 0–3 are complete. Phase 4 (visualization) is in active development — all 6 implementation phases are built (design tokens, block components, render_response tool, agent loop integration, frontend rendering, system prompt), now iterating on UI polish and tool description refinement through live testing. The agent has 11 tools including `render_response` for structured visual responses with 6 block types. The `get_marginal_odds` tool now accepts arrays of thresholds. Frontend renders typed content blocks (charts, tables, game summaries) via a BlockRenderer switch component, with markdown fallback for conversational responses.

## Key Project Files
Read these files for project orientation before starting work.

- `project-overview-clean.md` — project overview with implementation order and design decisions
- `plans/project/phase-1-plan.md` — Phase 1 plan (tool inventory, implementation patterns, collaboration checkpoints)
- `lib/tools.ts` — 10 tool functions with parameterized SQL queries
- `lib/toolDefs.ts` — tool definitions (name, description, input_schema) for Claude API
- `lib/systemPrompt.ts` — system prompt assembly (identity, domain knowledge, response guidelines)
- `docs/domain-knowledge.md` — foundational lottery concepts and decision-making context
- `docs/database_schema_reference.md` — all database tables, fields, and types
- `docs/calculated_metrics_reference.md` — metric formulas and calculation details
- `lib/agentLoop.ts` — tool-use loop core (prompt caching, iteration cap, usage tracking)
- `app/api/chat/route.ts` — agent loop API route with input validation
