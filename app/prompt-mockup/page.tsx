"use client";

import { T, S } from "@/lib/tokens";

// ─── Shared constants ────────────────────────────────────────────────────────

const SAMPLE_CHOICES = {
  prompt: "What matters most to you?",
  options: [
    "Best chance of winning anything",
    "Biggest potential prize",
    "Best value for the money",
    "Something else",
  ],
};

const SAMPLE_EXPLORE = [
  "Compare odds across prices",
  "Show me $5 games",
  "Which has the best jackpot?",
];

const VIZ_PROMPTS: Record<string, string[]> = {
  "Game Stats": ["Which game is the best value?", "Compare these games"],
  "Win Probability by Amount": [
    "Which prizes are most likely?",
    "Break down the odds",
  ],
  "Outcome Breakdown": [
    "What are my chances of winning?",
    "Best odds of breaking even?",
  ],
  "Risk vs Reward": ["Best risk/reward tradeoff?", "Explain this chart"],
};

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2
        style={{
          fontSize: T.sizeDisplay,
          fontWeight: T.weightDisplay,
          color: T.textPrimary,
          marginBottom: 4,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontSize: T.sizeBody,
            color: T.textSecondary,
            marginBottom: 20,
            lineHeight: T.lhBody,
          }}
        >
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

function OptionLabel({ label, desc }: { label: string; desc: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: T.sizeTitle,
          fontWeight: T.weightTitle,
          color: T.textPrimary,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: T.sizeSmall, color: T.textSecondary, lineHeight: T.lhSmall }}>
        {desc}
      </div>
    </div>
  );
}

function CategoryLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: T.sizeCaption,
        fontWeight: T.weightCategory,
        color: T.textTertiary,
        textTransform: "uppercase" as const,
        letterSpacing: 0.5,
        marginBottom: 8,
      }}
    >
      {text}
    </div>
  );
}

// ─── Fake user message for visual reference ──────────────────────────────────

function FakeUserMessage({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          padding: "10px 16px",
          borderRadius: T.cardRadius,
          background: T.accent,
          color: "#fff",
          fontSize: T.sizeBody,
          fontFamily: T.font,
          maxWidth: "85%",
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ─── Fake dashboard card ─────────────────────────────────────────────────────

function FakeVizCard({
  title,
  height = 100,
  footer,
}: {
  title: string;
  height?: number;
  footer?: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...S.card,
        border: `1px solid ${T.divider}`,
        padding: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ ...S.sectionTitle, fontFamily: T.font, marginBottom: 16 }}>
        {title}
      </div>
      <div
        style={{
          background: T.pageBg,
          borderRadius: T.smallRadius,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: T.textTertiary,
          fontSize: T.sizeSmall,
        }}
      >
        [chart area]
      </div>
      {footer}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLE OPTIONS — all derived from user message visual language
//
// User messages: solid indigo (#3949AB), white text, borderRadius 10px
// Prompt buttons: visual echo of that — "this will become a user message"
// ═════════════════════════════════════════════════════════════════════════════

// ─── Option A: Indigo Outline ────────────────────────────────────────────────
// Same shape + color as user message, but outlined instead of filled.
// "I'm the outline version of that solid bubble you already know."
// Hover fills toward the solid state — previewing what it becomes.

function StyleA({ text }: { text: string }) {
  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 16px",
        background: "transparent",
        border: `1.5px solid ${T.accent}`,
        borderRadius: T.cardRadius,
        cursor: "pointer",
        fontSize: T.sizeSmall,
        fontWeight: T.weightLabel,
        fontFamily: T.font,
        color: T.accent,
        transition: "background 0.15s, color 0.15s",
        whiteSpace: "nowrap" as const,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = T.accent;
        e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = T.accent;
      }}
    >
      {text}
    </button>
  );
}

// ─── Option B: Indigo Ghost Fill ─────────────────────────────────────────────
// Light indigo wash (same hue as user message at ~10% opacity).
// No border — just the tinted surface. Same border-radius as user messages.
// Hover deepens the fill toward the solid message color.

function StyleB({ text }: { text: string }) {
  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 16px",
        background: "rgba(57, 73, 171, 0.10)",
        border: "none",
        borderRadius: T.cardRadius,
        cursor: "pointer",
        fontSize: T.sizeSmall,
        fontWeight: T.weightLabel,
        fontFamily: T.font,
        color: T.accent,
        transition: "background 0.2s, color 0.2s",
        whiteSpace: "nowrap" as const,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(57, 73, 171, 0.85)";
        e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(57, 73, 171, 0.10)";
        e.currentTarget.style.color = T.accent;
      }}
    >
      {text}
    </button>
  );
}

// ─── Option C: Outline with Indigo Tint ──────────────────────────────────────
// Combines A and B: light indigo fill + indigo border.
// Slightly more presence than pure outline, still clearly "not sent yet."
// Hover fills fully.

function StyleC({ text }: { text: string }) {
  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 16px",
        background: "rgba(57, 73, 171, 0.06)",
        border: `1.5px solid rgba(57, 73, 171, 0.35)`,
        borderRadius: T.cardRadius,
        cursor: "pointer",
        fontSize: T.sizeSmall,
        fontWeight: T.weightLabel,
        fontFamily: T.font,
        color: T.accent,
        transition: "background 0.15s, color 0.15s, border-color 0.15s",
        whiteSpace: "nowrap" as const,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = T.accent;
        e.currentTarget.style.color = "#fff";
        e.currentTarget.style.borderColor = T.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(57, 73, 171, 0.06)";
        e.currentTarget.style.color = T.accent;
        e.currentTarget.style.borderColor = "rgba(57, 73, 171, 0.35)";
      }}
    >
      {text}
    </button>
  );
}

// ─── Option D: Solid Indigo (Lighter) ────────────────────────────────────────
// Nearly the same as user messages but at reduced opacity / lighter shade.
// White text on medium indigo. Hover deepens to full user-message indigo.
// Most direct visual connection — "I'm almost a message already."

function StyleD({ text }: { text: string }) {
  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 16px",
        background: "rgba(57, 73, 171, 0.65)",
        border: "none",
        borderRadius: T.cardRadius,
        cursor: "pointer",
        fontSize: T.sizeSmall,
        fontWeight: T.weightLabel,
        fontFamily: T.font,
        color: "#fff",
        transition: "background 0.15s",
        whiteSpace: "nowrap" as const,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = T.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(57, 73, 171, 0.65)";
      }}
    >
      {text}
    </button>
  );
}

// ─── Shared option card renderer ─────────────────────────────────────────────

function OptionCard({
  label,
  desc,
  StyleComponent,
}: {
  label: string;
  desc: string;
  StyleComponent: React.ComponentType<{ text: string }>;
}) {
  return (
    <div style={{ ...S.card, border: `1px solid ${T.divider}`, padding: 24 }}>
      <OptionLabel label={label} desc={desc} />

      <div style={{ marginBottom: 20 }}>
        <CategoryLabel text="As chat choices" />
        <p
          style={{
            fontSize: T.sizeBody,
            fontWeight: T.weightTitle,
            color: T.textPrimary,
            marginBottom: 10,
          }}
        >
          {SAMPLE_CHOICES.prompt}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {SAMPLE_CHOICES.options.map((opt) => (
            <StyleComponent key={opt} text={opt} />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <CategoryLabel text="As explore suggestions" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SAMPLE_EXPLORE.map((opt) => (
            <StyleComponent key={opt} text={opt} />
          ))}
        </div>
      </div>

      <div>
        <CategoryLabel text="As dashboard prompt" />
        <div style={{ display: "flex", gap: 8 }}>
          <StyleComponent text="Which prizes are most likely?" />
          <StyleComponent text="Break down the odds" />
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function PromptMockupPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.pageBg,
        fontFamily: T.font,
        padding: "40px 48px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontSize: 28,
          fontWeight: T.weightDisplay,
          color: T.textPrimary,
          marginBottom: 8,
        }}
      >
        Conversational Prompt Redesign
      </h1>
      <p
        style={{
          fontSize: T.sizeBody,
          color: T.textSecondary,
          marginBottom: 16,
          lineHeight: T.lhBody,
          maxWidth: 700,
        }}
      >
        User messages are solid indigo bubbles with white text and 10px radius.
        Prompt buttons should visually echo that — same color family, same shape —
        so users intuitively understand: &ldquo;clicking this becomes a message.&rdquo;
      </p>

      {/* Visual reference: actual user message */}
      <div style={{ marginBottom: 48, maxWidth: 400 }}>
        <CategoryLabel text="Reference: user message" />
        <FakeUserMessage text="Which $5 game has the best odds?" />
      </div>

      {/* ═══ SECTION 1: Button Style Options ═══ */}
      <Section
        title="1. Button Style Options"
        subtitle="All four use the same indigo hue and 10px border-radius as user messages. They differ in how 'close' to a sent message they look."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <OptionCard
            label="A — Indigo Outline"
            desc="Same shape as user message, but outlined. Hover fills to solid — previewing what it becomes."
            StyleComponent={StyleA}
          />
          <OptionCard
            label="B — Indigo Ghost Fill"
            desc="Light indigo wash (same hue at ~10%). No border. Hover deepens toward the solid message color."
            StyleComponent={StyleB}
          />
          <OptionCard
            label="C — Outline + Tint"
            desc="Combines outline and fill: subtle indigo background + soft indigo border. Most balanced presence."
            StyleComponent={StyleC}
          />
          <OptionCard
            label="D — Lighter Solid"
            desc="Already solid with white text, just lighter than sent messages. Hover deepens to full indigo. Most direct: 'I'm almost a message already.'"
            StyleComponent={StyleD}
          />
        </div>
      </Section>

      {/* ═══ SECTION 2: Dashboard Placement Options ═══ */}
      <Section
        title="2. Dashboard Prompt Placement"
        subtitle="Where should the prompts live on each dashboard card? Using Style A as the example."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Placement A — Card footer */}
          <div>
            <OptionLabel
              label="Placement A — Card Footer"
              desc="Prompts below the visualization, separated by a divider. See the data, then act on it."
            />
            <div style={{ maxWidth: 600 }}>
              <FakeVizCard
                title="Win Probability by Amount"
                height={120}
                footer={
                  <div
                    style={{
                      borderTop: `1px solid ${T.divider}`,
                      marginTop: 16,
                      paddingTop: 12,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <StyleA text="Which prizes are most likely?" />
                    <StyleA text="Break down the odds" />
                  </div>
                }
              />
            </div>
          </div>

          {/* Placement B — Floating bar */}
          <div>
            <OptionLabel
              label="Placement B — Floating Prompt Bar"
              desc="All prompts grouped in a sticky bar at the bottom of the dashboard."
            />
            <div
              style={{
                maxWidth: 600,
                position: "relative",
                border: `1px solid ${T.divider}`,
                borderRadius: T.cardRadius,
                overflow: "hidden",
                background: T.pageBg,
              }}
            >
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ ...S.card, padding: 16, border: `1px solid ${T.divider}` }}>
                  <div style={{ ...S.sectionTitle, fontFamily: T.font, marginBottom: 8 }}>
                    Game Stats
                  </div>
                  <div style={{ background: T.pageBg, height: 40, borderRadius: T.smallRadius }} />
                </div>
                <div style={{ ...S.card, padding: 16, border: `1px solid ${T.divider}` }}>
                  <div style={{ ...S.sectionTitle, fontFamily: T.font, marginBottom: 8 }}>
                    Odds Chart
                  </div>
                  <div style={{ background: T.pageBg, height: 40, borderRadius: T.smallRadius }} />
                </div>
              </div>
              <div
                style={{
                  background: T.cardBg,
                  borderTop: `1px solid ${T.border}`,
                  padding: "12px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <CategoryLabel text="Ask the agent" />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(VIZ_PROMPTS).map(([viz, prompts]) => (
                    <StyleA key={viz} text={prompts[0]} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Placement C — Inline below viz */}
          <div>
            <OptionLabel
              label="Placement C — Inline Below Visualization"
              desc="Prompt strip inside the card, directly under the chart. No header clutter."
            />
            <div style={{ maxWidth: 600 }}>
              <div style={{ ...S.card, border: `1px solid ${T.divider}`, padding: 20 }}>
                <div style={{ ...S.sectionTitle, fontFamily: T.font, marginBottom: 16 }}>
                  Win Probability by Amount
                </div>
                <div
                  style={{
                    background: T.pageBg,
                    borderRadius: T.smallRadius,
                    height: 120,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: T.textTertiary,
                    fontSize: T.sizeSmall,
                    marginBottom: 12,
                  }}
                >
                  [chart area]
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <StyleA text="Which prizes are most likely?" />
                  <StyleA text="Break down the odds" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ SECTION 3: Per-Visualization Prompt Text ═══ */}
      <Section
        title="3. Per-Visualization Prompts"
        subtitle="Each visualization gets specific, distinct prompts instead of generic 'Ask about this.'"
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {Object.entries(VIZ_PROMPTS).map(([viz, prompts]) => (
            <FakeVizCard
              key={viz}
              title={viz}
              height={80}
              footer={
                <div
                  style={{
                    borderTop: `1px solid ${T.divider}`,
                    marginTop: 16,
                    paddingTop: 12,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {prompts.map((p) => (
                    <StyleA key={p} text={p} />
                  ))}
                </div>
              }
            />
          ))}
        </div>
      </Section>

      {/* ═══ SECTION 4: In Chat Context ═══ */}
      <Section
        title="4. In Chat Context"
        subtitle="How prompts look inside an agent response, next to a user message for visual comparison."
      >
        <div style={{ maxWidth: 500, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Previous user message for reference */}
          <FakeUserMessage text="What $5 games are available in New Jersey?" />

          {/* Agent response with prompt buttons */}
          <div
            style={{
              background: T.agentBubbleBg,
              border: `1px solid ${T.divider}`,
              borderRadius: T.cardRadius,
              padding: 20,
              boxShadow: T.cardShadow,
            }}
          >
            <p
              style={{
                fontSize: T.sizeBody,
                color: T.textPrimary,
                lineHeight: T.lhBody,
                marginBottom: 16,
              }}
            >
              I found 3 games in your price range. The $5 Lucky 7s has the best overall
              odds at 1 in 3.8, while the $5 Crossword has the highest top prize at
              $100,000.
            </p>

            <p
              style={{
                fontSize: T.sizeBody,
                fontWeight: T.weightTitle,
                color: T.textPrimary,
                marginBottom: 10,
              }}
            >
              {SAMPLE_CHOICES.prompt}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {SAMPLE_CHOICES.options.map((opt) => (
                <StyleA key={opt} text={opt} />
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${T.divider}`, marginBottom: 12 }} />

            <div style={{ fontSize: T.sizeCaption, color: T.textTertiary, marginBottom: 8 }}>
              Or explore further:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SAMPLE_EXPLORE.map((opt) => (
                <StyleA key={opt} text={opt} />
              ))}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
