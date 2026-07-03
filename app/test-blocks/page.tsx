"use client";

import { T, S, PRICE_PALETTE, buildPriceColors, OUTCOME_COLORS } from "@/lib/tokens";
import { formatPrize } from "@/lib/chartUtils";
import GameStatsSummary from "@/components/blocks/GameStatsSummary";
import OddsChart from "@/components/blocks/OddsChart";
import ComparisonTable from "@/components/blocks/ComparisonTable";
import DepletionBars from "@/components/blocks/DepletionBars";
import RiskRewardScatter from "@/components/blocks/RiskRewardScatter";
import type {
  GameStatsSummaryBlock,
  OddsChartBlock,
  ComparisonTableBlock,
  DepletionBarsBlock,
  RiskRewardScatterBlock,
} from "@/components/blocks/types";

// ─── Hardcoded test data ────────────────────────────────────────────

const MOCK_GAMES = [
  {
    game_id: 1, game_name: "Gold Rush", game_number: "1501", price_tier: 5,
    risk_scaled: 3.2, reward_scaled: 6.8, avg_cash_prize: 45,
    top_prize_value: 500000, value_score: 72,
    p_losing: 0.675, marginal_odds: { "0": 0.325, "10": 0.28, "50": 0.065, "100": 0.018, "500": 0.00012, "1000": 0.00005, "5000": 0.000008, "10000": 0.000003, "50000": 0.0000008, "100000": 0.0000002 },
    image_url: null,
  },
  {
    game_id: 2, game_name: "Lucky 7s", game_number: "1489", price_tier: 5,
    risk_scaled: 4.1, reward_scaled: 5.2, avg_cash_prize: 32,
    top_prize_value: 250000, value_score: 58,
    p_losing: 0.72, marginal_odds: { "0": 0.28, "10": 0.22, "50": 0.048, "100": 0.012, "500": 0.00008, "1000": 0.00003, "5000": 0.000005, "10000": 0.000002, "50000": 0.0000005 },
    image_url: null,
  },
  {
    game_id: 3, game_name: "Diamond Dazzle", game_number: "1523", price_tier: 10,
    risk_scaled: 5.5, reward_scaled: 7.9, avg_cash_prize: 88,
    top_prize_value: 1000000, value_score: 81,
    p_losing: 0.62, marginal_odds: { "0": 0.38, "10": 0.32, "50": 0.09, "100": 0.035, "500": 0.0004, "1000": 0.00015, "5000": 0.00002, "10000": 0.000008, "50000": 0.000002, "100000": 0.0000005 },
    image_url: null,
  },
  {
    game_id: 4, game_name: "Cash Blast", game_number: "1510", price_tier: 2,
    risk_scaled: 2.1, reward_scaled: 3.4, avg_cash_prize: 12,
    top_prize_value: 50000, value_score: 45,
    p_losing: 0.78, marginal_odds: { "0": 0.22, "10": 0.15, "50": 0.02, "100": 0.005, "500": 0.00003, "1000": 0.00001, "5000": 0.000001 },
    image_url: null,
  },
];

// ─── Section wrapper ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{
        fontSize: T.sizePageTitle,
        fontWeight: T.weightPageTitle,
        color: T.textPrimary,
        fontFamily: T.font,
        marginBottom: 16,
        lineHeight: T.lhPageTitle,
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Game Card (test-page-only, not a block type) ──────────────────

function GameCard({ game }: { game: typeof MOCK_GAMES[0] }) {
  const overallOdds = `1 in ${(1 / (1 - game.p_losing)).toFixed(1)}`;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "52px 1fr",
      gap: 8,
      padding: "10px 14px",
      borderBottom: `1px solid ${T.divider}`,
      borderLeft: "3px solid transparent",
      fontFamily: T.font,
      maxWidth: 480,
    }}>
      {/* Image */}
      <div style={{
        width: 52, height: 52,
        borderRadius: T.smallRadius,
        background: T.pickBg,
        border: `1px dashed ${T.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: T.sizeCaption,
        color: T.textTertiary,
        alignSelf: "center",
      }}>
        IMG
      </div>
      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Name row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: T.sizeBody,
            fontWeight: T.weightTitle,
            color: T.textPrimary,
            lineHeight: T.lhTitle,
            wordBreak: "break-word",
            flex: 1,
          }}>
            {game.game_name}
            <span style={{
              fontSize: T.sizeCaption,
              fontWeight: T.weightBody,
              color: T.textTertiary,
              marginLeft: 3,
            }}>
              (#{game.game_number})
            </span>
          </span>
          {/* Price badge */}
          <span style={{
            fontSize: T.sizeCaption,
            fontWeight: T.weightLabel,
            color: T.textPrimary,
            background: "transparent",
            border: `1px solid ${T.badgeBorder}`,
            borderRadius: 3,
            padding: "1px 6px",
            flexShrink: 0,
            marginTop: 2,
            marginLeft: "auto",
          }}>
            ${game.price_tier}
          </span>
        </div>
        {/* Metrics grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
          marginTop: 5,
        }}>
          {/* Top Prize */}
          <div>
            <div style={{ ...S.metricLabel, textTransform: "uppercase", lineHeight: T.lhLabel }}>
              TOP PRIZE
            </div>
            <div style={{ fontSize: T.sizeSmall, fontWeight: T.weightBody, color: T.textPrimary, lineHeight: T.lhSmall }}>
              {formatPrize(game.top_prize_value)}
              <span style={{ fontSize: T.sizeCaption, color: T.textTertiary, marginLeft: 3 }}>
                (3)
              </span>
            </div>
          </div>
          {/* Overall Odds */}
          <div>
            <div style={{ ...S.metricLabel, textTransform: "uppercase", lineHeight: T.lhLabel }}>
              OVERALL ODDS
            </div>
            <div style={{ fontSize: T.sizeSmall, fontWeight: T.weightBody, color: T.textPrimary, lineHeight: T.lhSmall }}>
              {overallOdds}
            </div>
          </div>
          {/* Value Score */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ ...S.metricLabel, textTransform: "uppercase", lineHeight: T.lhLabel }}>
              VALUE
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
              <div style={{
                width: 36, height: 5, borderRadius: 3,
                background: T.border, overflow: "hidden",
              }}>
                <div style={{
                  width: `${game.value_score}%`, height: "100%",
                  borderRadius: 3, background: T.accent,
                }} />
              </div>
              <span style={{ fontSize: T.sizeSmall, fontWeight: T.weightDisplay, color: T.textPrimary }}>
                {Math.round(game.value_score)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Block test data ───────────────────────────────────────────────

const STATS_BLOCK: GameStatsSummaryBlock = {
  type: "game_stats_summary",
  game_name: "Gold Rush",
  game_number: "1501",
  image_url: null,
  metrics: [
    { label: "Price Rank", value: "#2 of 14" },
    { label: "Top Prize", value: formatPrize(500000), suffix: "(3 left)" },
    { label: "Overall Odds", value: `1 in ${(1 / (1 - 0.675)).toFixed(1)}` },
    { label: "Value Score", value: "72" },
  ],
};

const ODDS_SINGLE_BLOCK: OddsChartBlock = {
  type: "odds_chart",
  games: [MOCK_GAMES[0]] as OddsChartBlock["games"],
};

const ODDS_MULTI_BLOCK: OddsChartBlock = {
  type: "odds_chart",
  games: MOCK_GAMES.slice(0, 3) as OddsChartBlock["games"],
};

const COMPARISON_BLOCK: ComparisonTableBlock = {
  type: "comparison_table",
  columns: [
    { label: "Top Prize" },
    { label: "Overall Odds" },
    { label: "Odds $500+" },
    { label: "ROI per Dollar" },
  ],
  rows: [
    { label: "Gold Rush (#1501)", price_tier: 5, values: ["$500K", "32.500%", "0.012%", "-$0.35"] },
    { label: "Lucky 7s (#1489)", price_tier: 5, values: ["$250K", "28.000%", "0.008%", "-$0.42"] },
    { label: "Diamond Dazzle (#1523)", price_tier: 10, values: ["$1M", "38.000%", "0.040%", "-$0.28"] },
  ],
};

const DEPLETION_BLOCK: DepletionBarsBlock = {
  type: "depletion_bars",
  game_name: "Gold Rush",
  game_number: "1501",
  bands: [
    { name: "High", range: "$500+", pct: 82 },
    { name: "Mid", range: "$50 – $499", pct: 38 },
    { name: "Low", range: "Under $50", pct: 23 },
  ],
};

const SCATTER_BLOCK: RiskRewardScatterBlock = {
  type: "risk_reward_scatter",
  games: MOCK_GAMES,
};

// ─── Page ───────────────────────────────────────────────────────────

export default function TestBlocksPage() {
  return (
    <div style={{
      background: T.pageBg,
      minHeight: "100vh",
      padding: "40px 32px",
      fontFamily: T.font,
    }}>
      <h1 style={{
        fontSize: 32,
        fontWeight: T.weightDisplay,
        color: T.textPrimary,
        fontFamily: T.font,
        marginBottom: 40,
      }}>
        Block Style Validation
      </h1>

      {/* Game Cards (test-page-only) */}
      <Section title="Game Card">
        <div style={{ ...S.card, maxWidth: 480, overflow: "hidden" }}>
          {MOCK_GAMES.slice(0, 3).map((g) => (
            <GameCard key={g.game_id} game={g} />
          ))}
        </div>
      </Section>

      {/* Game Stats Summary */}
      <Section title="Game Stats Summary">
        <div style={{ ...S.card, maxWidth: 600, overflow: "hidden" }}>
          <GameStatsSummary block={STATS_BLOCK} />
        </div>
      </Section>

      {/* Risk-Reward Scatter */}
      <Section title="Risk-Reward Scatter">
        <div style={{ maxWidth: 700 }}>
          <RiskRewardScatter block={SCATTER_BLOCK} />
        </div>
      </Section>

      {/* Odds Chart — Single Game */}
      <Section title="Odds Chart — Single Game">
        <div style={{ maxWidth: 700 }}>
          <OddsChart block={ODDS_SINGLE_BLOCK} />
        </div>
      </Section>

      {/* Odds Chart — Multi Game */}
      <Section title="Odds Chart — Multi Game (3 games)">
        <div style={{ maxWidth: 700 }}>
          <OddsChart block={ODDS_MULTI_BLOCK} />
        </div>
      </Section>

      {/* Comparison Table */}
      <Section title="Comparison Table">
        <div style={{ maxWidth: 600 }}>
          <ComparisonTable block={COMPARISON_BLOCK} />
        </div>
      </Section>

      {/* Depletion Bars */}
      <Section title="Depletion Bars">
        <div style={{ maxWidth: 400 }}>
          <DepletionBars block={DEPLETION_BLOCK} />
        </div>
      </Section>

      {/* Color Swatches */}
      <Section title="Design Tokens — Price Palette">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {PRICE_PALETTE.map((color, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 48, height: 48, borderRadius: T.smallRadius, background: color }} />
              <span style={{ fontSize: T.sizeCaption, color: T.textSecondary, fontFamily: T.font }}>#{i + 1}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Design Tokens — Outcome Colors">
        <div style={{ display: "flex", gap: 12 }}>
          {Object.entries(OUTCOME_COLORS).map(([name, color]) => (
            <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 48, height: 48, borderRadius: T.smallRadius, background: color }} />
              <span style={{ fontSize: T.sizeCaption, color: T.textSecondary, fontFamily: T.font }}>{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Design Tokens — Typography">
        <div style={{ ...S.card, padding: 20, maxWidth: 500, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: T.sizePageTitle, fontWeight: T.weightPageTitle, color: T.textPrimary, fontFamily: T.font }}>Page Title (24/500)</div>
          <div style={{ fontSize: T.sizeDisplay, fontWeight: T.weightDisplay, color: T.textPrimary, fontFamily: T.font }}>Display (20/600)</div>
          <div style={{ fontSize: T.sizeTitle, fontWeight: T.weightTitle, color: T.textPrimary, fontFamily: T.font }}>Title (16/500)</div>
          <div style={{ fontSize: T.sizeBody, fontWeight: T.weightBody, color: T.textPrimary, fontFamily: T.font }}>Body (13/400)</div>
          <div style={{ fontSize: T.sizeSmall, fontWeight: T.weightSmall, color: T.textSecondary, fontFamily: T.font }}>Small (12/400)</div>
          <div style={{ fontSize: T.sizeLabel, fontWeight: T.weightLabel, color: T.textSecondary, fontFamily: T.font }}>Label (11/500)</div>
          <div style={{ fontSize: T.sizeCaption, fontWeight: T.weightCaption, color: T.textTertiary, fontFamily: T.font }}>Caption (10/400)</div>
        </div>
      </Section>
    </div>
  );
}
