# Principles for Building an Agent "Brain"

A synthesis of guiding principles for turning domain knowledge and user
journeys into an agent brain — drawn from the layered analytics system in the
source article and the design questions worked through alongside it.

## How to read this

These are **criteria, not a template.** Applied to different domains they
should yield different organizations — a convergent single-intent domain ends
up structured very differently from a multi-domain one, and that is correct.
None of these principles tells you *how* to lay out files, name sections, or
sequence logic. Each tells you what kind of knowledge belongs in the brain,
what should be left to the model, and what property a good encoding has —
regardless of shape.

The underlying stance: a capable model already knows how to reason. The brain
exists to supply the domain-specific judgment it could not infer, define the
concepts it would otherwise guess at, and bound the space it searches — and
then to get out of the way so the model can traverse that space itself.

---

## How to navigate these principles

The thirteen principles are listed below in a flat order, but they cluster by
the job each one does in building the brain — and the clusters fall into the
rough sequence you'd reason through while constructing one. Use this section as
the map; use the numbered list that follows as the detail.

One principle sits above the rest. **Principle 13 is the frame, not a step** —
it sets how much of each layer to formalize for a given domain's stakes, and
insists the layers stay separable so any one can change without disturbing the
others. It applies to the whole build rather than at any single point.

Beneath it, five clusters in build order:

**The boundary — principles 1–2 — "what goes in?"**
The governing discipline that decides what belongs in the brain at all.
Principle 1 sets where the line falls (encode judgment, leave reasoning);
Principle 2 sets the form of whatever lands on the encode side (principles, not
branches). Everything downstream is shaped by these, which is why they come
first.

**The substance — principles 3, 9, 10 — "what does it mean, and where do we stand?"**
The fixed knowledge the brain holds rather than reasons out fresh each time:
what the terms mean (3), what the product stands for (9), and how it treats what
it doesn't know (10). They group because all three are non-negotiable
commitments — the parts a model isn't allowed to improvise.

**The reach — principles 4–6 — "what can it do?"**
The capability layer, one decision seen three ways: constrain the space rather
than open it (4), make each capability return an answer rather than raw power
(5), and name it so the path of calls stays legible (6). This is where the brain
meets its tools.

**The manners — principles 7–8 — "how does it behave with people?"**
The live-exchange policy: don't gate on missing input (7), and treat asking as a
disposition rather than a scripted stop (8). Distinct from what the brain knows
or what it can do.

**The refinement — principles 11–12 — "how does it stay correct?"**
The acknowledgment that a brain is grown, not authored once: examples teach
reasoning and double as test material (11), and the trace-and-ablation loop
turns fluent into correct (12). They come last because they operate after the
other layers exist, then feed corrections back up into them.

In short: the **boundary** decides what goes in; **substance** and **reach** are
the two halves of what's in there — what it knows and what it can do; **manners**
govern how it behaves; **refinement** keeps it honest over time — all sized and
held apart by the **frame**.

---

## The principles

**1. Encode judgment, not sequence.**
The natural order of reasoning — explore broadly, narrow, compare, drill in —
is something a capable model already does; you don't script it. What you encode
is the domain judgment the model can't infer. The test for whether something
must be written down: *would someone fluent in the general field but new to
this specific domain get it wrong by default?* If yes, encode it. If no, trust
reasoning. The set of things that fail this test differs by domain, but the
test itself is constant.

**2. State principles, not branches.**
When cases multiply or pull against each other, encode the principle that
resolves them rather than enumerating combinations. A stated principle
generalizes to cases you never anticipated; an enumeration breaks on the first
one you missed. This is what keeps a brain from collapsing into a decision tree
and is the main reason to use a reasoning agent at all.

**3. Define each concept once, deliberately.**
Collapse ambiguity at the source: one human-authored definition per concept or
metric, treated as the single answer. Definitions that are duplicated,
auto-generated, or left implicit re-import the very ambiguity you're trying to
remove. Domains differ in how many concepts need this; none escape the
one-definition rule.

**4. Favor structure over access.**
The leverage is in curation and constraint, not in giving the model more raw
reach. Broad, unstructured access (open queries, dumping everything in) barely
improves correctness; bounding the space does. Give the model a small set of
well-defined capabilities rather than open-ended power, and let precomputed,
deterministic work be done before the model ever sees it.

**5. Make capabilities return answers, not raw power.**
Expose functions that perform selection and explanation, not arbitrary
computation or open queries. Keep the surface small and consolidated — fewer,
more capable functions reduce the chance of the model choosing wrongly. What
counts as "precomputable" varies by domain; the principle that the model
selects and explains rather than calculates does not.

**6. Name capabilities so the path reads like a sentence.**
The sequence of capability calls the model makes *is* the visible record of its
reasoning. Name and scope them so that record reads plainly on its own.
Observability is a design decision made when you name a tool, not a dashboard
bolted on afterward — a well-named surface makes the brain self-documenting and
debugging nearly free.

**7. Treat user-supplied context as optional narrowing, not a gate.**
Don't require information the user may not have. Provide a sensible default
response from whatever context exists, and let any additional context sharpen
it. The shape of the default differs by domain; the refusal to block on missing
input is general.

**8. Make asking a policy, not a checkpoint.**
Don't hard-code where the agent stops to ask questions. Encode a disposition:
answer with a reasonable default when you can, and ask only when an answer would
materially change the outcome — and then ask minimally. Higher-stakes domains
set that threshold lower; the policy form stays the same.

**9. Write the values down.**
Any behavior that serves the product's purpose but that a neutral model won't
produce on its own must be stated explicitly. Left unstated, reasoning fills the
gap with generic defaults, which may run directly against the point of the
product. Every domain has its own such commitments; identifying and naming them
is part of building the brain, not an afterthought.

**10. Be honest about the data.**
Never fabricate what a source doesn't provide; degrade gracefully when fields
are missing rather than inventing them; and make the provenance and freshness of
an answer visible so its trustworthiness can be judged. This holds in every
domain and is cheap to add from the start.

**11. Use examples to teach reasoning, not to enumerate cases.**
Real user journeys are illustrations of *how to think* in the domain, kept
explicitly subordinate to the principles and marked as non-exhaustive — so the
model reasons from principle and consults examples as reference, never slotting
a real user into a fixed archetype. The same journeys double as seeds for
evaluation and as a completeness check: a journey that doesn't map cleanly onto
your encoded judgment reveals a gap in it.

**12. Tune by trace, iterate by ablation.**
A brain is refined, not authored once. Run real questions through it, read the
reasoning paths to see where judgment misfires, change one thing, and compare
against a fixed set of expected outcomes. This loop — not the initial writing —
is what turns a fluent agent into a correct one. The visible reasoning path is
the instrument that makes the loop possible; treat it as a means, not the
product.

**13. Match structure to complexity, and keep the layers separable.**
Import only as much machinery as the domain's ambiguity and stakes justify —
elaborate infrastructure built for a sprawling, high-stakes domain is dead
weight on a narrow, convergent one. Keep the judgment (the brain) independent of
the capabilities (the tools) and of the runtime (the harness) so each can change
without disturbing the others, and so the brain ports across whatever runs it.

---

## Using these to organize a brain from raw material

Given a body of domain information and a set of user journeys, these principles
guide the organization without dictating it:

- The information splits along Principle 1 — domain judgment to encode versus
  universal reasoning to leave alone — and that split looks different in every
  domain.
- Concepts are pinned down once (3), capabilities are shaped to return answers
  and named for legibility (4, 5, 6), and the product's non-default commitments
  are surfaced and stated (9).
- The journeys become teaching examples and evaluation seeds, held beneath the
  principles rather than hardened into paths (11), and the gaps they expose feed
  back into the encoded judgment (12).
- How much of this gets formalized, and into what shape, is set by the domain's
  own complexity and stakes (13).

The same principles, applied to a different domain with different concepts,
journeys, and stakes, will produce a different organization — which is the
intended outcome.
