"use client";

import { T, S } from "@/lib/tokens";
import DashboardEmpty from "./DashboardEmpty";
import DashboardHeader from "./DashboardHeader";
import AskAboutLink from "./AskAboutLink";
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
  onAskAbout: (visual: string) => void;
}

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
        padding: 24,
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

// ─── Active dashboard ────────────────────────────────────────────────────────

function ActiveDashboard({
  data,
  onRemoveGame,
  onAskAbout,
}: {
  data: DashboardData;
  onRemoveGame: (gameId: number) => void;
  onAskAbout: (visual: string) => void;
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Game tray */}
      <DashboardHeader games={data.games} onRemoveGame={onRemoveGame} />

      {/* Stats / comparison table — full width */}
      <DashboardCard title="Game Stats" visual="stats_table" onAskAbout={onAskAbout}>
        <ComparisonTable block={statsBlock} />
      </DashboardCard>

      {/* Odds chart — full width */}
      <DashboardCard title="Win Probability by Amount" visual="odds_chart" onAskAbout={onAskAbout}>
        <OddsChart block={oddsBlock} />
      </DashboardCard>

      {/* Two-column: outcome bars + scatter */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DashboardCard title="Outcome Breakdown" visual="outcome_bars" onAskAbout={onAskAbout}>
          <OutcomeBars block={outcomeBlock} />
        </DashboardCard>

        <DashboardCard title="Risk vs Reward" visual="scatter" onAskAbout={onAskAbout}>
          <RiskRewardScatter block={scatterBlock} highlightedGameIds={highlightedScatterIds} />
        </DashboardCard>
      </div>
    </div>
  );
}

// ─── Dashboard card wrapper ──────────────────────────────────────────────────

function DashboardCard({
  title,
  visual,
  onAskAbout,
  children,
}: {
  title: string;
  visual: string;
  onAskAbout: (visual: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...S.card, padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={S.sectionTitle}>{title}</div>
        <AskAboutLink visual={visual} onAsk={onAskAbout} />
      </div>
      {children}
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
      <div style={{ display: "flex", gap: 8, padding: "12px 0", borderBottom: `1px solid ${T.divider}` }}>
        <div style={{ ...skeletonBar, width: 120, height: 28 }} />
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ ...S.card, padding: 16 }}>
          <div style={{ ...skeletonBar, width: 140, height: 16, marginBottom: 12 }} />
          <div style={{ ...skeletonBar, width: "100%", height: 120 }} />
        </div>
        <div style={{ ...S.card, padding: 16 }}>
          <div style={{ ...skeletonBar, width: 120, height: 16, marginBottom: 12 }} />
          <div style={{ ...skeletonBar, width: "100%", height: 120 }} />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
