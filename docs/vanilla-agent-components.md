# Vanilla Agent — Component Map

The first build: tools + an always-on system prompt. **No** intent router, **no**
funnel, **no** on-demand skill loading. Run it, watch how the agent navigates the
tools, and let the gaps tell you what to add next.

---

## Always-on (system prompt)
Assembled by your loop, sent every turn.
- **Identity & scope** — scratchers only; what the agent does.
- **Domain knowledge** — how the lottery works, player psychology, and the
  *meaning* of each metric (value score = price-aware risk/reward, etc.) in a
  sentence or two.
- **Response guidelines** — behavior + output, all paths.

*Not in vanilla:* the intent router, the funnel.

## Tools (code functions, called freely — no routing)
- **Retrieval** — one parameterized `query_games` (filter / sort / list).
- **Single game** — `get_game_detail`.
- **Computed metrics** — a few functions (marginal odds, outcome odds, depletion,
  value).
- **Schema lookup** — `get_schema`, kept as its own tool so you can watch the agent
  call it.
- **Visualization** — chart tool(s), for final answers.

All read-only, scoped credential, aggregated outputs, **no raw-dump tool**.

## Reference files (knowledge) — where each lives in vanilla
- **Schema + data concepts** (fields + what ticket / prize / tier / losing-ticket /
  overall-odds mean) → served by the `get_schema` **tool**. The one reference kept
  as a lookup.
- **Domain knowledge** (lottery mechanics, fixation) → **ambient** (system prompt).
- **Metric *meaning*** → **ambient**, folded into domain knowledge. No separate
  file — the *computation* lives in the metric tools; only the light meaning is
  ambient.
- **Response guidelines** → **ambient** (system prompt).

→ Only **one** reference is a separate lookup (schema + concepts); the rest are
ambient.

## Loaded on demand via a skill
**Nothing, in vanilla.** The only on-demand action is a tool call (including
`get_schema`). Skill loading is the layer you add *after* vanilla, if the run shows
you need it.

## Held in reserve (not in the vanilla agent)
- **Funnel & journeys** → used now as your **eval question set** to test vanilla
  against; becomes a loadable skill in the routed version later.
- **Intent router** → added after vanilla, only if observation shows the agent
  mis-navigates.

## Where files live (repo)
- **System-prompt text** (identity + domain + metric meanings + guidelines) →
  assembled by your loop (or a CLAUDE.md if you test in Claude Code).
- **`/lib`** → tool functions + parameterized SQL; the schema doc that `get_schema`
  reads.
- **Funnel doc** → kept aside for evals.

## The vanilla test (one line)
Register the tools, put the always-on text in the system prompt, leave out the
router and funnel — then run the five journey questions and watch: does the agent
call `get_schema` before querying? Does it chain filter → compare → drill on its
own? Where does its unguided judgment go wrong? Those gaps are the spec for what to
add next.
