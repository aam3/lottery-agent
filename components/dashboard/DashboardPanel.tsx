"use client";

import { T, S } from "@/lib/tokens";
import DashboardEmpty from "./DashboardEmpty";
import DashboardHeader from "./DashboardHeader";
import PromptButton from "@/components/PromptButton";
import ComparisonTable from "@/components/blocks/ComparisonTable";
import OddsChart from "@/components/blocks/OddsChart";
import OutcomeBars from "@/components/blocks/OutcomeBars";
import RiskRewardScatter from "@/components/blocks/RiskRewardScatter";
import type { DashboardGameInfo } from "./DashboardHeader";
import type {
  ComparisonTableBlock,
  OddsChartBlock,
  OutcomeBarsBlock,
  RiskRewardScatterBlock,
} from "@/components/blocks/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardData {
  games: DashboardGameInfo[];
  statsTable: {
    columns: { label: string }[];
    rows: { label: string; priceTier?: number; values: string[] }[];
  };
  oddsChart: {
    games: OddsChartBlock["games"];
  };
  outcomeBars: {
    games: OutcomeBarsBlock["games"];
  };
  scatter: {
    highlighted: RiskRewardScatterBlock["games"];
    context: RiskRewardScatterBlock["games"];
  };
}

export type DashboardMode = "empty" | "loading" | "active";

interface DashboardPanelProps {
  mode: DashboardMode;
  data: DashboardData | null;
  onRemoveGame: (gameId: number) => void;
  onAskAbout: (visual: string, question?: string) => void;
}

// ─── Per-visualization prompts ───────────────────────────────────────────────

const VIZ_PROMPTS: Record<string, string[]> = {
  stats_table: ["Which game is the best value?", "Compare these games"],
  odds_chart: ["Which prizes are most likely?", "Break down the odds"],
  outcome_bars: ["What are my chances of winning?", "Best odds of breaking even?"],
  scatter: ["Best risk/reward tradeoff?", "Explain this chart"],
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPanel({
  mode,
  data,
  onRemoveGame,
  onAskAbout,
}: DashboardPanelProps) {
  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        background: T.pageBg,
        padding: 28,
        fontFamily: T.font,
      }}
    >
      {mode === "empty" && <DashboardEmpty />}
      {mode === "loading" && <LoadingSkeleton />}
      {mode === "active" && data && (
        <ActiveDashboard
          data={data}
          onRemoveGame={onRemoveGame}
          onAskAbout={onAskAbout}
        />
      )}
    </div>
  );
}

// ─── Prompt footer strip ─────────────────────────────────────────────────────

function PromptFooter({
  visual,
  onAskAbout,
}: {
  visual: string;
  onAskAbout: (visual: string, question?: string) => void;
}) {
  const prompts = VIZ_PROMPTS[visual];
  if (!prompts) return null;

  return (
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
      {prompts.map((prompt) => (
        <PromptButton
          key={prompt}
          text={prompt}
          onClick={() => onAskAbout(visual, prompt)}
        />
      ))}
    </div>
  );
}

// ─── Active dashboard ────────────────────────────────────────────────────────

function ActiveDashboard({
  data,
  onRemoveGame,
  onAskAbout,
}: {
  data: DashboardData;
  onRemoveGame: (gameId: number) => void;
  onAskAbout: (visual: string, question?: string) => void;
}) {
  // Build block objects for existing components
  const statsBlock: ComparisonTableBlock = {
    type: "comparison_table",
    columns: data.statsTable.columns,
    rows: data.statsTable.rows.map((r) => ({
      label: r.label,
      price_tier: r.priceTier,
      values: r.values,
    })),
  };

  const oddsBlock: OddsChartBlock = {
    type: "odds_chart",
    games: data.oddsChart.games,
  };

  const outcomeBlock: OutcomeBarsBlock = {
    type: "outcome_bars",
    games: data.outcomeBars.games,
  };

  const scatterBlock: RiskRewardScatterBlock = {
    type: "risk_reward_scatter",
    games: [...data.scatter.highlighted, ...data.scatter.context],
  };

  const highlightedScatterIds = new Set(
    data.scatter.highlighted.map((g) => g.game_id).filter((id): id is number => id != null),
  );

  const cardTitle = (title: string) => (
    <div style={{ ...S.sectionTitle, fontFamily: T.font, marginBottom: 20 }}>
      {title}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Game tray */}
      <DashboardHeader games={data.games} onRemoveGame={onRemoveGame} />

      {/* Stats / comparison table */}
      <ComparisonTable
        block={statsBlock}
        header={cardTitle("Game Stats")}
        footer={<PromptFooter visual="stats_table" onAskAbout={onAskAbout} />}
      />

      {/* Odds chart — full width */}
      <OddsChart
        block={oddsBlock}
        header={cardTitle("Win Probability by Amount")}
        footer={<PromptFooter visual="odds_chart" onAskAbout={onAskAbout} />}
      />

      {/* Two-column: outcome bars + scatter */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <OutcomeBars
          block={outcomeBlock}
          header={cardTitle("Outcome Breakdown")}
          footer={<PromptFooter visual="outcome_bars" onAskAbout={onAskAbout} />}
        />

        <RiskRewardScatter
          block={scatterBlock}
          highlightedGameIds={highlightedScatterIds}
          header={cardTitle("Risk vs Reward")}
          footer={<PromptFooter visual="scatter" onAskAbout={onAskAbout} />}
        />
      </div>
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  const skeletonBar = {
    background: T.divider,
    borderRadius: T.smallRadius,
    animation: "pulse 1.5s ease-in-out infinite",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tray skeleton */}
      <div style={{
        display: "flex",
        gap: 8,
        padding: "12px 0",
        borderBottom: `1px solid ${T.divider}`,
      }}>
        <div style={{ ...skeletonBar, width: 120, height: 24 }} />
        <div style={{ ...skeletonBar, width: 100, height: 24 }} />
      </div>
      {/* Stats table skeleton */}
      <div style={{ ...S.card, padding: 16 }}>
        <div style={{ ...skeletonBar, width: 100, height: 16, marginBottom: 12 }} />
        <div style={{ ...skeletonBar, width: "100%", height: 80 }} />
      </div>
      {/* Odds chart skeleton */}
      <div style={{ ...S.card, padding: 16 }}>
        <div style={{ ...skeletonBar, width: 180, height: 16, marginBottom: 12 }} />
        <div style={{ ...skeletonBar, width: "100%", height: 200 }} />
      </div>
      {/* Two-column skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ ...S.card, padding: 16 }}>
          <div style={{ ...skeletonBar, width: 140, height: 16, marginBottom: 12 }} />
          <div style={{ ...skeletonBar, width: "100%", height: 120 }} />
        </div>
        <div style={{ ...S.card, padding: 16 }}>
          <div style={{ ...skeletonBar, width: 120, height: 16, marginBottom: 12 }} />
          <div style={{ ...skeletonBar, width: "100%", height: 120 }} />
        </div>
      </div>
    </div>
  );
}
