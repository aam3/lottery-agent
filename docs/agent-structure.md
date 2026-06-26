# Agent Structure — Technical Reference

A plain description of how a tool-using chat agent is wired: what the pieces
are, how they connect, what gets sent to the model and what does not, and how
to stand up a local prototype without exposing the database credential.

Scope note: this document covers the **mechanics only** — functions, wiring,
the request payload, and the loop. It deliberately says nothing about what
instruction text the agent should contain or how that text is organized.
Wherever the "system prompt" is mentioned, treat it as an opaque block of text
you supply.

---

## 1. The pattern

This is the standard agent design, usually called the **agent loop** or
**tool-use loop**. Every tool-using agent is some version of it. A framework
(e.g. the Claude Agent SDK) writes the loop for you; doing it by hand is the
same shape with the loop spelled out.

The model itself has no memory, no file access, and cannot run code. It takes
in text and returns text. The text it returns may be a final answer **or** a
request to call one of the tools you gave it. All execution happens in your
code. The model only decides; your code acts.

---

## 2. The four parts

**1. Tools (functions).** A module of plain functions, one per capability.
Each one runs a parameterized, read-only query and returns data. The database
credential is used *inside* these functions and nowhere else.

**2. Tool definitions.** For each function: a `name`, a `description`, and an
`input_schema` (the parameters and their types). This is the *only* thing the
model ever learns about a tool. The model never sees the function body.

**3. System prompt text.** A block of instruction text you supply, passed to
the model on every request. (Out of scope here: what it contains.)

**4. The loop.** The plumbing that connects the above to the model and runs
tool calls when the model asks for them.

---

## 3. Two separate channels (this is why the key is safe)

There are exactly two connections in the system, and they never touch:

- **Path A — your code ↔ the database.** The credential is used here, locally,
  to open a connection and run queries. Functions return *data*.
- **Path B — your code ↔ the model.** Your code assembles a request payload by
  hand and sends it over the network. The payload has fields for the system
  prompt, the conversation, and the tool definitions — and **no field for a
  credential**.

```python
# Path A — talk to the database. The credential is used HERE, and only here.
def query_games(state, price):
    conn = connect(DATABASE_URL)              # secret used locally, inside the function
    rows = conn.run(
        "SELECT ... FROM games WHERE state = ? AND price = ?",
        state, price,                         # parameterized — values can't become SQL
    )
    return rows                               # the function returns ONLY data

# Path B — talk to the model. You build the payload field by field.
response = client.post({
    "model":    "claude-...",
    "system":   SYSTEM_PROMPT_TEXT,           # you chose to include this
    "messages": conversation,                 # ...and this
    "tools":    [query_games_definition],     # ...and this
    # DATABASE_URL appears nowhere here. There is no field for it.
})
```

The credential opens the cabinet; the model is handed the document, never the
key. Nothing "blocks" the key from crossing — there is simply no slot in the
payload that would carry it, and no code path that puts it there.

---

## 4. The request payload

Every call to the model is one request containing a small, fixed set of fields:

| Field      | Contents                                                        |
|------------|-----------------------------------------------------------------|
| `model`    | which model to use                                              |
| `max_tokens` | response length cap                                           |
| `system`   | your system prompt text                                         |
| `messages` | the conversation so far (user turns, model turns, tool results) |
| `tools`    | your tool definitions (`name`, `description`, `input_schema`)   |

The model sees the contents of these fields and nothing else in your program.
Default is exclusion: something reaches the model only because you placed it in
one of these fields.

A single tool definition looks like:

```json
{
  "name": "query_games",
  "description": "Returns games for a state filtered by price. Read-only.",
  "input_schema": {
    "type": "object",
    "properties": {
      "state": { "type": "string", "description": "Two-letter state code." },
      "price": { "type": "number", "description": "Ticket price in dollars." }
    },
    "required": ["state"]
  }
}
```

---

## 5. The loop

```
conversation = [ user_message ]

build request = {
    system:   SYSTEM_PROMPT_TEXT,
    messages: conversation,
    tools:    tool_definitions,
}
send request to model

loop:
    if the model returns a TOOL CALL (a tool name + arguments):
        result = run the matching function with those arguments
        append the tool result to conversation
        send the updated request to the model again
    if the model returns TEXT:
        that text is the answer — stop
```

The model emits **tool calls**; your code emits **tool results**. They
alternate until the model produces a final text answer. A tool call can only
name a tool from the `tools` list and supply arguments matching its schema —
so the tool list is simultaneously the model's full menu of actions and the
fence around what it can reach. It cannot "read a file" or "run SQL" unless you
registered a tool that does that.

---

## 6. Why the key never crosses — as a checklist

The credential cannot reach the model because of two facts, both of which you
can verify by reading your own code:

1. **The request payload has no field for a secret.** It carries the system
   prompt, the conversation, and tool definitions. The credential is none of
   these.
2. **No registered tool exposes the credential.** Your tools return query
   results, not connection strings or environment variables.

The one discipline that preserves this: **functions return data only — never
place a credential into a tool result or into the system prompt.**

---

## 7. MVP build: your own loop + a simple chat front end

The MVP runs the loop yourself (sections 4–5) rather than driving an existing
CLI harness or pulling in a framework SDK. For a single-domain agent with a
handful of tools this is the simplest and most transparent option, and it gives
you the two things an MVP needs: the tool constraint for free, and a visible
trace you can read while you chat.

**Shape: one app, one route.** A single Next.js app (App Router) with one API
route that runs the loop server-side. The route holds the conversation, calls
the Messages API with the tool definitions passed inline, runs the matching
function when the model asks for a tool, appends the result, and loops until the
model returns text. The browser holds a state selector and a chat box.

**The tool constraint is free here.** In your own harness the model can only
emit calls for tools in the `tools` array you send — there is no shell, no file
access, no arbitrary SQL, because you never registered those verbs. There is
nothing to lock down. (This is the contrast with driving a general CLI coding
agent, which ships with those verbs and would have to be fenced in.)

**The trace is free here too.** Every turn the model returns `tool_use` blocks
(name + arguments) and your code produces `tool_result` blocks. That ordered
sequence *is* the reasoning path. Have the route return it alongside the answer
and render each step as a card in the UI — e.g. `→ query_games(state=OH,
price=20)` then `← 12 games`, then the final text. No separate tracing service;
the viewer is part of the same app.

**Skip streaming at first.** Run the whole loop, then return `{ steps, answer }`
and render them together. You still see the full path — just after the turn
finishes rather than token-by-token. Add streaming later only if the wait feels
long.

Minimal pieces:

```
/app
  /api/chat/route.ts   # the loop: inline tool definitions, calls the model,
                       # runs functions, returns { steps:[tool calls+results], answer }
  page.tsx             # state selector + chat box + trace-card list
/lib
  tools.ts             # the functions + parameterized, read-only SQL against Neon;
                       # the scoped DATABASE_URL lives only in server env here
  toolDefs.ts          # name / description / input_schema for each function
.env.local             # DATABASE_URL (read-only, table-scoped) — gitignored
```

**Credential safety holds exactly as in the rest of this doc.** The scoped,
read-only `DATABASE_URL` lives only in server-side `tools.ts`, is used to open
the Neon connection, and is never placed in the request payload — and no tool
returns it. Use a read-only role limited to the game/prize tables (not
subscriber data) as the floor.

### Tech choices for the MVP

- **Keep:** Next.js (App Router) + Tailwind, run locally (`next dev`) — no
  deployment for the MVP. Neon, with the existing schema unchanged and a
  read-only, table-scoped credential.
- **Defer:** Vercel deployment. Running locally sidesteps the serverless time
  limit entirely (see caveat) and is all you need to chat, watch the trace, and
  refine. Ship to Vercel later, once turns are short or streaming is in place.
- **Optional:** Recharts — only if you want the agent to render trend charts in
  the MVP; otherwise defer.
- **Drop / defer for the MVP:** MCP (only needed for the CLI-harness path; inline
  tools are simpler in one self-contained app), Framer Motion (decorative for a
  test rig), and ISR / server-component revalidation (that's for the public SEO
  dashboard, not a chat view you sit and watch).

**Why local for now:** a multi-step loop can exceed Vercel's serverless function
time limit, and chasing that during early testing is wasted effort. Running
locally has no such limit, so the loop can take as long as it needs while you
watch it. Revisit Vercel only when you're ready to deploy — by then you can
raise the route's max duration, add streaming, or move the loop to a
non-serverless runtime.

---

## 8. From MVP to production

Because the MVP is already your own loop in a web app, moving to production is
mostly hardening and scaling, not re-architecting:

- **Keep as-is:** the tool functions and the parameterized, read-only, scoped
  database access — these are the durable core.
- **Add as needed:** streaming responses, caching, rate limiting, the public
  dashboard views, and email capture — the product surface around the agent.
- **Optional later:** adopt the Agent SDK if maintaining the loop glue becomes a
  chore, or expose the tools via MCP if a second consumer needs them. Neither is
  required; both are contained swaps, because the functions and instruction text
  carry over untouched.

The functions, the trace, and the credential-safety properties carry straight
through. What changes is the polish and scale around them, not the core.

---

## 9. One-line summary

A tool-using agent is: **functions that return data + definitions describing
them + a loop that sends `{system, messages, tools}` to the model and runs any
tool the model asks for.** The database credential lives only inside the
functions, never in the payload — so there is no channel, in either direction,
for it to reach the model.
