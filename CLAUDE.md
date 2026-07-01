## REQUIRED ACTION AT SESSION START

Before responding to any user message, ask the user: "Would you like to load project context? (I can run /prime to load the project primer and feature contexts, or we can skip and start working.)" Do NOT proceed with any other response until this question is answered. If the user says yes, run `/context-scaffolding-plugin:prime`.

## Project Summary

Lottery Scratcher Agent — a locally-run chat agent that answers questions about scratch-off lottery games across five U.S. states (NJ, CA, FL, NY, OH). Queries a Neon PostgreSQL database populated by an existing scraper, provides probability/statistics analysis, game comparisons, and recommendations for non-technical lottery players. Built as an MVP and learning exercise in structuring domain knowledge and tools for tool-using LLM agents.

## Repo Structure

### Project Root

```
project-root/
├── app/                          # Next.js App Router
│   ├── api/chat/route.ts         # Agent loop API route
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Chat UI
│   └── globals.css               # Tailwind directives
├── lib/                          # Server-side modules
│   ├── db.ts                     # Neon database client (exports sql)
│   ├── anthropic.ts              # Anthropic SDK client
│   ├── tools.ts                  # Tool functions (parameterized SQL)
│   ├── toolDefs.ts               # Tool definitions for Claude API
│   └── systemPrompt.ts           # System prompt assembly
├── docs/                         # Project documentation
│   ├── project-overview-clean.md # Current project overview
│   ├── domain-knowledge.md       # Lottery domain concepts
│   ├── database_schema_reference.md
│   ├── calculated_metrics_reference.md
│   ├── agent-response-guidelines.md
│   ├── agent-brain-principles.md
│   ├── agent-structure.md
│   ├── vanilla-agent-components.md
│   └── visualization-reference.md  # Deferred
├── specs/                        # Project specifications
├── plans/                        # Project and feature plans
│   ├── project/
│   └── features/
├── session/                      # Session tracking
│   ├── active-feature.txt
│   └── learnings/
├── .claude/                      # Plugin infrastructure
│   ├── _docs/                    # CLAUDE.md source files
│   ├── _reference/               # Reference documentation
│   └── commands/prime/features/  # Feature contexts
├── .env.local                    # Secrets (gitignored)
├── .env.example                  # Documents required env vars
└── package.json
```

### Key Conventions

- **`app/` and `lib/`** follow Next.js App Router conventions — no `src/` directory
- **`docs/`** holds all project documentation and reference material
- **`lib/tools.ts`** is the only file that touches the database — credential safety by construction
- **`.env.local`** contains `DATABASE_URL` and `ANTHROPIC_API_KEY` — never committed

### .claude/ Organization

```
.claude/
├── _docs/                        # Governance source files for CLAUDE.md
├── _reference/                   # Active reference docs (cataloged below)
├── commands/
│   └── prime/
│       ├── project-primer.md
│       └── features/
└── settings.local.json           # Local permissions
```

## Coding Conventions

- TypeScript throughout — strict mode enabled
- Tailwind CSS for styling (deferred to later phases)
- Neon serverless driver with tagged template literals for parameterized queries
- All database queries are read-only and parameterized — no raw SQL interpolation
- Tool functions accept a single params object and return `Promise<object>`
- Tool functions catch errors and return structured `{ error: string }` rather than throwing
- Import paths use `@/*` alias (maps to project root)

## Reference Documentation

Before answering questions or making decisions about the topics below, check the corresponding reference file in `.claude/_reference/`. Read the file before proceeding rather than relying on training knowledge, as these contain project-specific conventions and up-to-date details.

| Topic | File | Description |
|-------|------|-------------|
| Agent teams | `_reference/agent-teams-reference.md` | Multi-agent orchestration in Claude Code — experimental feature for parallel agent coordination |
| Hooks system | `_reference/hooks-reference.md` | How hooks work in Claude Code — configuration, script placement, event types, matchers, handlers |
| Plugin development workflow | `_reference/plugins/claude-code-plugin-dev-workflow.md` | Developing plugins across projects — keeping the plugin repo as source of truth while iterating in host projects |
| Plugin system | `_reference/plugins/plugin-system.md` | Managing reusable Claude Code plugins — structure, plugin.json, standalone vs plugin approaches |
| Skills configuration | `_reference/skills-configuration.md` | Creating, configuring, and managing Claude Code skills — SKILL.md format, frontmatter, references, auto-discovery |
| Subagents | `_reference/subagents-reference.md` | Specialized AI assistants with custom context, tool access, and permissions — delegation and orchestration |

If a question touches on any of these topics, read the relevant file first.
If unsure whether a reference exists, list the contents of `.claude/_reference/`.

## Session Management

- Feature status lifecycle: brainstorming -> designing -> planning -> building -> complete.
- Accessing context files via `/prime:*` is read-only — does not switch the active feature.

## Development Rules

- IMPORTANT: Always ask for explicit approval from the user before calling any LLM API
- Always launch `PLAN` mode when requesting a response from the user
- NEVER make domain assumptions — always ask the user explicitly for feedback and clarification
- Treat `docs/` as reference material — do not modify without explicit instruction
- Tool descriptions are routing in the vanilla agent — be precise about what a tool does and does NOT return, and cross-reference related tools
- Review tool descriptions collaboratively with the user before committing
- Don't include pipeline/data-processing concerns in agent tool descriptions — only reference fields the agent works with
- Agent tool functions should only pull stored values — computation belongs in the data pipeline
- Metric tools should require game IDs — no state-level queries that could dump full datasets
- Domain knowledge defines terms and concepts, not data characteristics or correlations — let data speak through tools
- When the agent ignores soft guidance, promote it to hard rules rather than rewording
- Remove tool output fields the agent can't interpret correctly rather than prompting around them
- Make a metric's relevance-driving context into a required parameter of its tool
- When JSON Schema can't express "one of A or B required," consolidate to a single required param

### Writing Style

Be succinct and precise and straightforward. High signal-to-word ratio without losing meaning. Structure and organize info cleanly, relying on lists where applicable and minimizing long segments of prose. This writing style should get passed through to subagents and agent teams as well.

### Plans

- Plan files use `##` sections for phases, each with a `Status:` field (`not started`, `in progress`, `complete`, `blocked`)
- Feature plans live in `plans/features/{feature-name}/`
- Project-wide plans live in `plans/project/`
