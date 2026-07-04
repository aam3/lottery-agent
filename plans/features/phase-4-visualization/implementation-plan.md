# Phase 4 Visualization — Implementation Plan

## Context

The agent currently returns free-form markdown in `{ answer: string }`. Phase 3 testing showed this causes inconsistent formatting and raw data leaking into prose. This plan implements typed content blocks: the agent calls a `render_response` tool with structured block data, and the frontend renders each block with a pre-built React component. All design decisions were made in the preceding discussion phase.

---

## Phase 1: Design System & Shared Utilities
Status: complete (including buildPriceColors)

Already done during style validation:
- `lib/tokens.ts` — design tokens
- `lib/chartUtils.tsx` — shared format functions, chart components, utilities
- `app/test-blocks/page.tsx` — visual validation page
- Recharts installed, Outfit font loaded

**Remaining work:** Replace `PRICE_COLORS` hardcoded map with `PRICE_PALETTE` array + `buildPriceColors(priceTiers)` utility in `lib/tokens.ts` and `lib/chartUtils.tsx`.

---

## Phase 2: Block Components
Status: complete

Create `components/blocks/` directory with one file per block type. Each component receives typed props matching the tool schema shape.

### Files to create:

**`components/blocks/BlockRenderer.tsx`**
- Switch component mapping `block.type` to the correct component
- Wraps each block in consistent spacing
- Skips blocks with unrecognized types (malformed block safety)

**`components/blocks/TextBlock.tsx`**
- Renders `content` string via ReactMarkdown
- No card wrapper — text flows naturally

**`components/blocks/GameStatsSummary.tsx`**
- Props: `game_name`, `game_number`, `image_url`, `metrics: { label, value, suffix? }[]`
- Image (52x52) on left, horizontal metrics row
- Accent color auto-applied when label contains "rank" (case-insensitive)
- Reuse from test page implementation

**`components/blocks/OddsChart.tsx`**
- Props: `games: { game_name, game_number, price_tier, p_losing, marginal_odds }[]`
- Adapts internally: 1 game = single accent line, no legend; 2–4 games = colored lines, dash patterns, centered legend
- Uses `buildPriceColors()` for dynamic color assignment
- Reuse chart logic from test page

**`components/blocks/ComparisonTable.tsx`**
- Props: `games: { game_name, game_number, price_tier }[]`, `rows: { label, values: string[] }[]`
- Agent pre-formats values as strings
- PricePill headers, divider styling from tokens
- Uses `buildPriceColors()` for PricePill colors

**`components/blocks/DepletionBars.tsx`**
- Props: `bands: { name, range, pct }[]`
- Three horizontal bars, color-coded by health (green >75%, yellow 25-75%, red <25%)
- No remaining count text
- Card wrapper with "Prize Pool Health" title

**`components/blocks/RiskRewardScatter.tsx`**
- Props: `games: { game_name, game_number, price_tier, risk_scaled, reward_scaled, avg_cash_prize, top_prize_value }[]`
- Bubble chart with price-tier colors, bubble size legend
- Uses `buildPriceColors()` for dynamic colors

**`components/blocks/types.ts`**
- TypeScript interfaces for each block type's props
- Union type `Block` for the BlockRenderer

---

## Phase 3: render_response Tool
Status: complete

### `lib/toolDefs.ts`
Add `render_response` to the `toolDefinitions` array:
- `name: "render_response"`
- `description`: short instruction — "Format the final response for the user. Call as the last step after gathering all data needed to answer the question."
- `input_schema`: `blocks` array with `oneOf` for each block type. Each block type object has its own `description` explaining when to use it and what not to confuse it with.
- Block type descriptions follow the same collaborative review pattern we used for tool descriptions in Phase 1.

### `lib/tools.ts`
Add `render_response` to `toolHandlers`:
```ts
async function render_response(params: { blocks: Block[] }) {
  return { blocks: params.blocks };
}
```
Pass-through function — schema enforcement happens on the API side.

---

## Phase 4: Agent Loop Integration
Status: complete

### `lib/agentLoop.ts`

**Change the return type** to support both formats:
```ts
Promise<{
  steps: ToolStep[];
  answer?: string;
  blocks?: Block[];
  usage: UsageSummary;
}>
```

**Intercept render_response in the tool-use loop:**
- When a tool call is `render_response`, extract the blocks from the tool result
- Store them on the result object
- After the loop completes (end_turn), check if blocks were captured:
  - If yes: return `{ steps, blocks, usage }` (no `answer`)
  - If no: return `{ steps, answer, usage }` (current behavior)

**Important:** The agent may still produce text blocks alongside the render_response call. If render_response was called, blocks take priority — any text is supplementary and can be ignored or included as a `text` block.

### `app/api/chat/route.ts`
No changes — already passes through the agentLoop result transparently.

---

## Phase 5: Frontend Rendering
Status: complete

### `app/page.tsx`

**Update Turn interface:**
```ts
interface Turn {
  question: string;
  steps: ToolStep[];
  answer?: string;
  blocks?: Block[];
  usage: UsageSummary;
}
```

**Update API response handling** (around line 83):
- Read `data.blocks` if present, `data.answer` if not
- Set turn with whichever is present

**Update rendering** (around line 163):
- If `turn.blocks` exists: render via `<BlockRenderer blocks={turn.blocks} />`
- If `turn.answer` exists: render via `<ReactMarkdown>` (current behavior)
- Both can coexist — blocks for structured responses, markdown for simple conversational answers

---

## Phase 6: System Prompt Update
Status: complete

### `lib/systemPrompt.ts`

Add a short section (new const, added to the assembly array before GUARDRAILS):
- Tell the agent to use `render_response` as the final step when the response benefits from structured visualization
- Keep it brief and action-based per our dev rules
- Do NOT describe block types here — that's in the tool schema descriptions
- Draft the instruction collaboratively with user review before committing

---

## Implementation Order

1. **Phase 1 remaining** — `buildPriceColors` utility
   - ✅ Visual check: update test page to use `buildPriceColors()`, verify colors render identically

2. **Phase 2** — Block components + types + BlockRenderer
   - ✅ Visual check: update test page to import from `components/blocks/` instead of inline components, verify all blocks render identically to current test page

3. **Phase 3a** — Tool definition + handler code
   - Write the `render_response` tool definition with `oneOf` schema for all block types
   - Write initial descriptions for each block type within the schema
   - Add pass-through handler to `tools.ts`
   - ✅ Build check: `npx next build` compiles

4. **Phase 3b** — Tool description & schema review (STOP AND REVIEW)
   - Review the full `render_response` tool definition together
   - For each block type: review its description (when to use, when NOT to use, what not to confuse it with)
   - For each block type: review its input schema (required fields, field descriptions, constraints like max 4 games on odds_chart)
   - Refine descriptions collaboratively, same process as Phase 1 tool description audit
   - Only proceed after approval

5. **Phase 4** — Agent loop changes
   - ✅ Build check: `npx next build` compiles

6. **Phase 5** — Frontend rendering
   - ✅ Visual check: start dev server, navigate to chat, verify block rendering in browser
   - ✅ End-to-end test: ask questions targeting each block type, verify correct blocks appear:
     - "Compare these two $5 games in NJ" → `comparison_table` + `text`
     - "Show me the best $5 games in NJ" → `game_stats_summary` blocks
     - "What are the odds for [game]?" → `odds_chart` (single game)
     - "How depleted is [game]?" → `depletion_bars`
   - ✅ Fallback test: simple conversational question → plain text, no render_response

7. **Phase 6** — System prompt instruction (STOP AND REVIEW)
   - Draft the render_response instruction
   - Review together before committing
   - Keep it brief and action-based per dev rules

8. **Final review** — end-to-end demo with user

Each phase is independently testable. Phases 2-3 can be built and visually verified on the test page before wiring into the agent loop.

---

## Files Modified

| File | Change |
|---|---|
| `lib/tokens.ts` | Replace `PRICE_COLORS` with `PRICE_PALETTE` + `buildPriceColors()` |
| `lib/chartUtils.tsx` | Update imports, remove `PRICE_COLORS` usage, use `buildPriceColors()` |
| `lib/toolDefs.ts` | Add `render_response` tool definition with block type schemas |
| `lib/tools.ts` | Add `render_response` pass-through handler |
| `lib/agentLoop.ts` | Change return type, intercept render_response, return blocks |
| `lib/systemPrompt.ts` | Add render_response instruction section |
| `app/page.tsx` | Update Turn interface, conditional block/markdown rendering |
| `app/test-blocks/page.tsx` | Update to use `buildPriceColors()` |

## Files Created

| File | Purpose |
|---|---|
| `components/blocks/types.ts` | Block type interfaces and union type |
| `components/blocks/BlockRenderer.tsx` | Switch component mapping type → component |
| `components/blocks/TextBlock.tsx` | ReactMarkdown wrapper |
| `components/blocks/GameStatsSummary.tsx` | Single game + metrics row |
| `components/blocks/OddsChart.tsx` | Probability line chart (1–4 games) |
| `components/blocks/ComparisonTable.tsx` | Flexible metric comparison table |
| `components/blocks/DepletionBars.tsx` | Prize pool health bars |
| `components/blocks/RiskRewardScatter.tsx` | Risk/reward bubble chart |

---

## Deviations from Original Plan

- **comparison_table schema flipped:** Rows are now items (games or strategies), columns are metrics. Original had games as columns and metrics as rows. Changed because the original couldn't handle multi-ticket strategy comparisons.
- **p_losing removed from odds_chart:** Chart reads threshold 0 from marginal_odds instead. Simplifies data flow — agent only needs get_marginal_odds.
- **get_marginal_odds accepts array:** Changed from single `threshold` to `thresholds: number[]`. Agent was making 10 separate calls for odds chart data.
- **DepletionBars gained game_name/game_number:** Not in original plan. Added during testing to label which game each depletion chart belongs to.
- **GameStatsSummary layout changed:** Image spans full height of name + metrics (not inline with metrics). Game name displayed as header above metrics row.

## Collaboration Checkpoints (STOP points)

1. **After Phase 2** — Visual check: do extracted components match the test page?
2. **Phase 3b** — Tool description & schema review: review each block type's description and input schema together. Refine until routing guidance is precise. This is the most important review point.
3. **After Phase 5** — End-to-end demo: ask questions in the chat UI and review block rendering together in the browser.
4. **Phase 6** — System prompt instruction review: review the render_response instruction before committing.
