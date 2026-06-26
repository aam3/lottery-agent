# Phase 1: Tool Functions, Tool Definitions, and System Prompt

## Context

Phase 0 (infrastructure) is complete. The Next.js app skeleton, Neon client,
and Anthropic client are in place. Phase 1 implements the 9 tool functions,
their API definitions, and the system prompt — everything the agent needs to
start answering questions before the loop and chat UI are wired up in Phase 2.

The user wants separate metric tools (not bundled with query_games) so that
tool-call traces show which metrics the agent reaches for. This is a learning
exercise in tool design.

---

## Tool inventory (9 tools)

### Retrieval tools (query database tables directly)

| # | Name | Table(s) | Purpose |
|---|------|----------|---------|
| 1 | `query_games` | `games` | List/filter/sort active games by state and price |
| 2 | `get_prizes` | `prizes` + `games` | Prize tiers for a game (labels, values, remaining) |
| 3 | `get_prize_snapshots` | `prize_snapshots` + `prizes` | Historical remaining counts over time |
| 4 | `get_freshness` | `states` | When data was last scraped for a state |

### Metric tools (query game_metrics, joined with games for context)

| # | Name | Fields | Purpose |
|---|------|--------|---------|
| 5 | `get_outcome_probabilities` | p_losing, p_breaking_even, p_winning_cash | Win/loss probability distribution |
| 6 | `get_marginal_odds` | mo_0 through mo_100000 | Probability of winning >= threshold |
| 7 | `get_depletion` | depletion_high/mid/low | Prize pool health by dollar band |
| 8 | `get_value_metrics` | value_score, roi, reward_raw, risk_raw | Value ranking and risk/reward analysis |

### Schema lookup

| # | Name | Source | Purpose |
|---|------|--------|---------|
| 9 | `get_schema` | Hardcoded content | Schema reference and data concept definitions |

---

## Implementation order

### Step 1: `get_schema` + `get_freshness`

Build the simplest tools first to validate the pattern.

- `get_schema` — no SQL, returns hardcoded reference content organized by
  table name and concept category. Forces us to organize the schema/concepts
  reference that informs all other tools.
- `get_freshness` — single-row query from `states`. Validates the Neon `sql`
  tagged template against the live database.

### Step 2: `query_games`

The primary retrieval tool. Introduces dynamic WHERE (conditional price_tier
filter) and validated ORDER BY. Returns game basics only — no metrics join.
Description must explicitly direct the agent to metric tools for analysis.

### Step 3: `get_prizes` + `get_prize_snapshots`

- `get_prizes` — accepts game_id OR (state + game_number) for lookup.
  Returns full prize tier breakdown.
- `get_prize_snapshots` — historical data, needed for depletion fallback.

### Step 4: All four metric tools

These follow the same pattern: JOIN game_metrics + games, accept game_id or
game_ids, return metrics with game context (name, number, price_tier, state).

- `get_outcome_probabilities`
- `get_marginal_odds`
- `get_depletion` — when stored values are NULL (e.g., Ohio where
    `total_tickets` isn't published), computes depletion using the
    `prize_snapshots` fallback: `MAX(prizes_remaining)` per prize tier as the
    denominator (captures the post-replenishment peak for reprinted games).
    Only returns NULL when no prizes exist in a dollar band.
- `get_value_metrics` — adds `state` param for rankings mode, includes
  image_url for recommendations

### Step 5: System prompt

Written after all tools are defined. Three sections:
1. **Identity & scope** — what the agent is, scratchers-only boundary
2. **Domain knowledge** — condensed from `docs/domain-knowledge.md` (meanings,
   not formulas; edge cases)
3. **Response guidelines** — from `docs/agent-response-guidelines.md` (nearly
   verbatim)

New file: `/lib/systemPrompt.ts`

### Step 6: Validation checkpoint

Test each tool function against the live Neon database with known inputs.
Verify edge cases (Ohio depletion NULLs, game_number lookup, price filter).

---

## Collaboration checkpoints

### Checkpoint A: After Step 1-2

Review `get_schema` content and `query_games` tool description together.
- Does `query_games` description clearly say it does NOT include metrics?
- Does it direct the agent to the metric tools?
- Is the `sort_by` enum right? Should it include `overall_odds`?

### Checkpoint B: After Step 4

Review all four metric tool descriptions together.
- Can you tell from descriptions alone when to call `get_outcome_probabilities`
  vs. `get_marginal_odds`?
- Is `get_value_metrics` clearly the "which game is best" tool?
- Does `get_depletion` signal the Ohio NULL case?
- Are game_id vs game_ids params consistent?

### Checkpoint C: After Step 5

Review the complete system prompt.
- Is domain knowledge succinct enough?
- Does it avoid duplicating tool descriptions?
- Is "never respond without a state" prominent?
- Are all edge cases covered?

---

## Key implementation patterns

**Neon tagged template with conditional WHERE:**
```typescript
const rows = price_tier
  ? await sql`SELECT ... WHERE state = ${state} AND price_tier = ${price_tier} AND is_active = true`
  : await sql`SELECT ... WHERE state = ${state} AND is_active = true`;
```

**Validated ORDER BY (prevent SQL injection):**
```typescript
const SORT_COLUMNS: Record<string, string> = {
  price_tier: "price_tier", game_number: "game_number", game_name: "game_name"
};
const sortCol = SORT_COLUMNS[sort_by ?? "price_tier"];
```

**game_id vs game_ids normalization (all metric tools):**
```typescript
const ids = params.game_ids ?? (params.game_id ? [params.game_id] : []);
```

**Metric tools include game context** — JOIN with games to return game_name,
game_number, price_tier, state so the agent doesn't need a second query_games
call.

**Error handling** — catch and return structured errors rather than throwing,
so the agent loop can pass them as tool results.

**Tool dispatcher map** — export for Phase 2's loop:
```typescript
export const toolHandlers: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  query_games, get_prizes, get_prize_snapshots, get_freshness,
  get_outcome_probabilities, get_marginal_odds, get_depletion, get_value_metrics,
  get_schema,
};
```

---

## Files to create/modify

| File | Action | Content |
|------|--------|---------|
| `/lib/tools.ts` | Replace placeholder | 9 tool functions + types + dispatcher map |
| `/lib/toolDefs.ts` | Replace placeholder | 9 tool definitions (name, description, input_schema) |
| `/lib/systemPrompt.ts` | Create new | System prompt text (identity + domain + guidelines) |

No changes to `/lib/db.ts` or `/lib/anthropic.ts`.

## Verification

1. Each tool function called with valid params returns expected data
2. `query_games({ state: "NJ" })` returns games
3. `query_games({ state: "OH", price_tier: 5 })` filters correctly
4. `get_prizes({ state: "OH", game_number: "..." })` resolves by game_number
5. `get_depletion` for an Ohio game computes depletion via prize_snapshots fallback
6. `get_value_metrics({ state: "NJ" })` returns ranked games with image_url
7. `get_freshness({ state: "NJ" })` returns timestamp
8. `get_schema()` returns organized reference content
9. All functions handle missing/invalid params with structured error responses
