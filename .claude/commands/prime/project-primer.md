# Project: Lottery Scratcher Agent

## Overview
A locally-run chat agent that answers questions about scratch-off lottery games across five U.S. states (NJ, CA, FL, NY, OH). Queries a Neon PostgreSQL database populated by an existing scraper, provides probability/statistics analysis, game comparisons, and recommendations for non-technical lottery players. Built as an MVP and learning exercise in structuring domain knowledge and tools for tool-using LLM agents — the domain is deliberately small so the patterns transfer to larger projects.

## Current State
Phases 0–4 complete. The recommendation tool (`optimize_multi_ticket_bundle`) is in Phase 5 — parameter calibration and testing. Core engine (3-method router, beam search, convolution DP) is built and integrated. Agent conversation flow refined: tool description gating prevents premature bundling and risk inference, clickable choices block for preference questions, break-even semantics clarified. Diversity factor (D=2) prevents price-tier concentration at large budgets. Budget probe extracted into separate tool for performance (6-41x speedup on escalation). 13 tools total including `probe_budget_for_goal` and 7 block types in `render_response`. Remaining: beam width/MAX_BUCKETS tuning, end-to-end chat UI verification.

## Key Project Files
Read these files for project orientation before starting work.

- `project-overview-clean.md` — project overview with implementation order and design decisions
- `plans/project/phase-1-plan.md` — Phase 1 plan (tool inventory, implementation patterns, collaboration checkpoints)
- `lib/tools.ts` — 13 tool functions with parameterized SQL queries
- `lib/toolDefs.ts` — tool definitions (name, description, input_schema) for Claude API
- `lib/systemPrompt.ts` — system prompt assembly (identity, domain knowledge, response guidelines)
- `docs/domain-knowledge.md` — foundational lottery concepts and decision-making context
- `docs/database_schema_reference.md` — all database tables, fields, and types
- `docs/calculated_metrics_reference.md` — metric formulas and calculation details
- `lib/agentLoop.ts` — tool-use loop core (prompt caching, iteration cap, usage tracking)
- `app/api/chat/route.ts` — agent loop API route with input validation
