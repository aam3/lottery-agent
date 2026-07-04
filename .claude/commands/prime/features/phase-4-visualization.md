# Feature: Phase 4 Visualization

## Status
building — all 6 implementation plan phases complete, iterating on UI polish and tool description refinement through live testing

## Description
Replace free-form markdown agent responses with typed content blocks rendered by pre-built React components. Agent calls a `render_response` tool (Option B architecture) with a blocks array; the tool's JSON Schema enforces block structure. Frontend renders blocks as a vertical stack via a `BlockRenderer` switch component. Six block types: `text`, `game_stats_summary`, `odds_chart`, `comparison_table`, `depletion_bars`, `risk_reward_scatter`. Design system uses Outfit font, inline styles via design tokens, Recharts for charts. Price tier colors assigned dynamically based on state's unique price tiers.

## Key Files
Read these files for feature context. Files already listed in the project primer are not repeated here.

- `components/blocks/` — all block component files (BlockRenderer, types, and 6 block components)
- `lib/tokens.ts` — design system tokens and `buildPriceColors()` utility
- `lib/chartUtils.tsx` — shared format functions, chart sub-components (PricePill, LineSwatch, CrossCursor), and utilities
- `app/test-blocks/page.tsx` — visual style validation page with hardcoded data for all block types including strategy comparison
- `plans/features/phase-4-visualization/implementation-plan.md` — full implementation plan with phases, deviations, and collaboration checkpoints
- `docs/visualization-reference.md` — design system tokens, Recharts component specs, and shared utilities for all block types
- `docs/typography-and-game-card-spec.md` — typography system, game card layout spec
