# Lottery Scratcher Agent — Project Overview

A locally-run chat agent that answers questions about lottery scratch-off games
across five U.S. states. The agent queries a Neon PostgreSQL database (populated
by an existing scraper) and provides probability/statistics analysis, game
comparisons, and recommendations — aimed at non-technical lottery players.

This is an MVP and a portfolio piece. It is also a deliberate learning exercise
in how to structure information for a tool-using agent — how to decide what
goes in the system prompt vs. tool descriptions vs. reference lookups, how to
design tool boundaries so the agent picks the right one, and how to use tool
call tracing to observe and refine agent behavior. The lottery domain is small
enough that a simpler solution would work, but the point is to build the
muscles for structuring agent information so they transfer to larger or
multi-domain projects later.

---

## What exists already

- **Database**: Neon PostgreSQL with tables for `states`, `games`, `prizes`,
  `prize_snapshots`, `scraper_runs`, `game_metrics`, and
  `game_metrics_snapshots`. Populated by an existing scraper across five states.
- **Computed metrics**: The `game_metrics` table has values for probability
  distribution, marginal odds, risk/reward, ROI, value score, and depletion
  bands. Risk, reward, and value score formulas are in progress but values are
  currently populated — tool functions can pull them as-is, and if formulas get
  refined later the stored values get recomputed upstream.
- **Documentation**: Domain knowledge, schema reference, calculated metrics
  reference, response guidelines, agent architecture, brain principles, and
  visualization reference (deferred for now).

## What needs to be built

The Next.js application: tool functions, tool definitions, system prompt, the
agent loop, and a plain-text chat interface.

---

## Agent design — vanilla

The first build uses tools + an always-on system prompt. No intent router, no
funnel, no on-demand skill loading. The goal is to observe how the agent
navigates the tools via tool-call tracing, and let the gaps reveal what to add
next.

### Tools (code functions, called freely — no routing)

Three categories of tools for the vanilla agent:

1. **Retrieval tools** — parameterized, read-only SQL queries against the
   database. The agent gets data through these; it never has direct DB access.
   Distinct data needs:
   - **Games** — filter/sort/list games by state, price, etc. (from `games`)
   - **Prizes** — prize tiers and prizes remaining for a game (from `prizes`)
   - **Prize snapshots** — historical remaining counts over time (from
     `prize_snapshots`). Needed at minimum for the depletion `total_tickets`
     fallback for states like Ohio.
   - **Freshness** — when the data was last scraped for a state (from
     `states.last_scraped_at`). Needed for the freshness note the agent must
     include in responses.

   Whether these are separate tools or folded into each other (e.g., prize
   snapshots folded into the depletion metric tool) is a design decision for
   Phase 1.

2. **Metric tools** — pull computed metric values from `game_metrics` or compute
   from prize data.
   - Marginal odds, outcome probabilities (p_losing, p_breaking_even,
     p_winning_cash), depletion bands, value score, risk/reward
   - The depletion tool must handle the `total_tickets` fallback: when
     `total_tickets` is NULL for a prize tier (e.g., all Ohio games), use the
     most recent highest `prizes_remaining` value from `prize_snapshots` — and
     specifically the value after replenishment if the game was replenished, not
     before.

3. **Schema lookup** — `get_schema` returns the schema and data-concept
   reference so the agent can self-orient. Kept as its own tool so we can
   observe whether and when the agent calls it.

**Not in vanilla:** visualization tools. These get layered on after the agent's
reasoning and tool-calling behavior are solid.

### System prompt (always-on, every turn)

Assembled from three knowledge sources:

- **Identity & scope** — what the agent is, scratchers-only boundary
- **Domain knowledge** — lottery mechanics, metric meanings, player psychology,
  edge cases (Ohio missing `total_tickets`, OH ENTRY TICKET treated as losing,
  free tickets as break-even, NULL `prize_value` exclusion). Sourced from
  `domain-knowledge.md`.
- **Response guidelines** — lead with the answer, be honest about odds, never
  feed jackpot fixation, disclose tradeoffs, be succinct, end with freshness
  note. Sourced from `agent-response-guidelines.md`.

Only the schema/data-concepts reference is kept as a tool lookup (via
`get_schema`). Everything else is ambient.

### What the vanilla test reveals

Run questions and watch the trace: does the agent call `get_schema` before
querying? Does it chain filter then compare then drill on its own? Does it pick
the right tool for the question? Where does its unguided judgment go wrong?
Those gaps are the spec for what to add next.

---

## Architecture

### Tech stack

- **Next.js** (App Router) + Tailwind, run locally via `next dev`
- **Neon** PostgreSQL with existing schema, read-only table-scoped credential
- **Claude** Messages API with inline tool definitions
- No deployment for the MVP — local only

### File structure

```
/app
  /api/chat/route.ts   # the agent loop: tool definitions inline, calls Claude,
                       # runs tool functions, returns { steps, answer }
  page.tsx             # state selector + chat box + trace cards
/lib
  tools.ts             # tool functions + parameterized SQL against Neon
  toolDefs.ts          # name / description / input_schema for each tool
.env.local             # DATABASE_URL (read-only, table-scoped) — gitignored
```

### Credential safety

Two separate channels that never touch:

- **Path A (code to DB)**: The `DATABASE_URL` is used inside tool functions to
  open a connection and run parameterized queries. Functions return data only.
- **Path B (code to model)**: The request payload carries `{system, messages,
  tools}` — no field for a credential, and no tool returns one.

### The agent loop

```
conversation = [user_message]
build request = { system, messages: conversation, tools: tool_definitions }
send to Claude

loop:
  if model returns TOOL_USE:
    result = run matching function with those arguments
    append tool result to conversation
    send updated request again
  if model returns TEXT:
    that's the answer — stop

return { steps: [all tool calls + results], answer: final text }
```

No streaming initially. The whole loop runs, then `{ steps, answer }` is
returned and rendered together.

---

## Implementation order

### Phase 1: Foundation — tool functions, definitions, and system prompt

**1a. Tool functions (`/lib/tools.ts`)**

Each function is a parameterized, read-only SQL query against Neon. This is
where correctness is established — everything downstream depends on these
returning the right data.

Key implementation details:
- All probability/metric tools must use net value (`prize_value - price_tier`),
  never raw prize value.
- Depletion bands must implement the `total_tickets` fallback via
  `prize_snapshots` for states like Ohio that don't publish per-tier totals.
- Free tickets are break-even (net value = 0), not a separate category.
- OH ENTRY TICKET tiers are losing (prize_value = 0), not free.
- Prize tiers with NULL `prize_value` are excluded from probability denominators.
- Risk/reward/value score values are pulled from `game_metrics` as stored.

**1b. Tool definitions (`/lib/toolDefs.ts`)**

The `name`, `description`, and `input_schema` for each tool. In the vanilla
agent, tool descriptions are the routing — they need to be precise enough that
the model picks the right tool and supplies correct arguments without explicit
routing logic.

**1c. System prompt text**

Assemble identity, domain knowledge, and response guidelines into the system
prompt block. Sourced from the existing docs.

**1d. Validation checkpoint**

Manually test each tool function against the live Neon database before moving
on. Verify SQL returns correct data, edge cases are handled, and the
`prize_snapshots` fallback works for Ohio games.

### Phase 2: Agent loop and minimal chat frontend

**2a. API route (`/app/api/chat/route.ts`)**

The agent loop as described above. Assemble the request, send to Claude, execute
tool calls, loop until text, return `{ steps, answer }`.

**2b. Chat page (`/app/page.tsx`)**

Bare-bones interface: state selector dropdown, chat input, message display (text
only), and a simple rendering of tool trace steps (tool name + arguments +
result summary). No styling beyond basic readability.

When a visualization tool is eventually added, its output will just render as
raw JSON or a placeholder at this stage.

**2c. End-to-end integration test**

Run `next dev`, pick a state, ask a simple question, verify the full loop works:
user message through API route through Claude through tool call through DB query
through tool result through final answer through rendered in browser.

### Phase 3: Agent testing and refinement via tool tracing

**3a. Systematic testing**

Run diverse questions and watch the traces:
- Does the agent pick the right tool for each question?
- Does it chain tools correctly (filter, then compare, then drill)?
- Does it follow response guidelines?
- Does it handle "no state set" correctly (ask and do nothing else)?
- Does it handle the top-prize trap (reframe with marginal odds)?
- Does it handle missing data gracefully (Ohio depletion, NULL fields)?

**3b. Iterative refinement**

Based on trace observations: adjust tool descriptions, refine system prompt
language, add guardrails. Change one thing at a time, compare results. No intent
routing unless traces consistently show the agent mis-navigating.

### Phase 4: Structured response blocks and visualizations

**Architecture decision (from Phase 3 testing): Pattern 1 — Structured data → Frontend components.**

Phase 3 testing revealed that free-form markdown responses cause two systemic problems: inconsistent formatting (same question type gets different layouts every time) and raw data leaking into prose despite hard rules. The fix is architectural, not prompt-based.

The agent returns an array of typed content blocks instead of a markdown string. The frontend has a pre-built React component for each block type. The agent decides *what* to show (which games, which metrics, what order); the components decide *how* it looks.

**Block types:**
- `game_card` — styled card with image, name, price, game number
- `odds_chart` — Recharts visualization of probability distributions
- `metric_summary` — styled display of value score, ROI
- `prize_table` — formatted table with tiers and odds (component controls what's displayed — no raw counts)
- `comparison_table` — side-by-side game comparison
- `text` — agent's narrative analysis (the only free-form part)

**Why this pattern:**
- Data types are known (games, prizes, metrics, comparisons) — no surprise shapes
- Consistency matters — same game card looks the same every time
- Solves raw data leaking structurally — components control what gets rendered
- Simpler than code generation (Pattern 2) or hybrid (Pattern 3)
- Recharts components can be pre-built and reused

**Response format change:** API returns `{ blocks: [...] }` instead of `{ answer: "markdown string" }`. The frontend maps each block to its React component.

**Also includes:**
- Design system integration (Outfit font, color tokens, card styles from `visualization-reference.md`)
- Single game report component for consistent game presentations
- Multi-game comparison component with shared Recharts plots

### Phase 5: Polish and portfolio demo (deferred)

- Real-time tool trace panel (side panel showing reasoning path as it happens)
- Streaming responses (SSE pushing each step as it completes)
- Visual polish using the design system
- Beautiful, legible demo suitable for a portfolio piece

---

## Key references

| Doc | Purpose |
|-----|---------|
| `domain-knowledge.md` | Lottery concepts, metric meanings, decision-making context, edge cases |
| `database_schema_reference.md` | All tables, fields, types, and descriptions |
| `calculated_metrics_reference.md` | Metric formulas, table/field locations, calculation details |
| `agent-response-guidelines.md` | Behavioral rules for the agent's output |
| `agent-brain-principles.md` | Guiding principles for building the agent brain |
| `vanilla-agent-components.md` | Component map for the vanilla (first) agent build |
| `agent-structure.md` | Technical reference for the agent loop and architecture |
| `visualization-reference.md` | Recharts component code and design system (deferred) |
