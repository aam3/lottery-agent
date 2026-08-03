"use client";

import type { Block } from "./types";
import TextBlock from "./TextBlock";
import GameStatsSummary from "./GameStatsSummary";
import OddsChart from "./OddsChart";
import ComparisonTable from "./ComparisonTable";
import DepletionBars from "./DepletionBars";
import RiskRewardScatter from "./RiskRewardScatter";
import ChoicesBlock from "./ChoicesBlock";
import ExploreOptions from "./ExploreOptions";
import RecentBigWins from "./RecentBigWins";
import OutcomeBars from "./OutcomeBars";

interface BlockRendererProps {
  blocks: Block[];
  onChoiceSelect?: (choice: string, prompt: string) => void;
  onExploreSelect?: (option: string) => void;
  onExploreGame?: (gameName: string, gameNumber: string, gameId?: number) => void;
  onCompareGames?: (gameIds: number[]) => void;
  choicesDisabled?: boolean;
  dashboardGameIds?: Set<number>;
}

function renderBlock(
  block: Block,
  onChoiceSelect?: (choice: string, prompt: string) => void,
  onExploreSelect?: (option: string) => void,
  onExploreGame?: (gameName: string, gameNumber: string, gameId?: number) => void,
  onCompareGames?: (gameIds: number[]) => void,
  choicesDisabled?: boolean,
  dashboardGameIds?: Set<number>,
) {
  switch (block.type) {
    case "text":
      return <TextBlock block={block} />;
    case "game_stats_summary":
      return <GameStatsSummary block={block} onExplore={onExploreGame} disabled={choicesDisabled} dashboardGameIds={dashboardGameIds} />;
    case "odds_chart":
      return <OddsChart block={block} />;
    case "comparison_table":
      return <ComparisonTable block={block} onCompare={onCompareGames} dashboardGameIds={dashboardGameIds} />;
    case "depletion_bars":
      return <DepletionBars block={block} />;
    case "risk_reward_scatter":
      return <RiskRewardScatter block={block} />;
    case "choices":
      return (
        <ChoicesBlock
          block={block}
          onSelect={onChoiceSelect}
          disabled={choicesDisabled}
        />
      );
    case "explore_options":
      return (
        <ExploreOptions
          block={block}
          onSelect={onExploreSelect}
          disabled={choicesDisabled}
        />
      );
    case "recent_big_wins":
      return <RecentBigWins block={block} />;
    case "outcome_bars":
      return <OutcomeBars block={block} />;
    default:
      return null;
  }
}

export default function BlockRenderer({
  blocks,
  onChoiceSelect,
  onExploreSelect,
  onExploreGame,
  onCompareGames,
  choicesDisabled,
  dashboardGameIds,
}: BlockRendererProps) {
  // Enforce display order: content first, then interactive (choices/explore_options),
  // then freshness ("data last updated") last. Preserves relative order within each group.
  const content: Block[] = [];
  const interactive: Block[] = [];
  const freshness: Block[] = [];

  for (const block of blocks) {
    if (block.type === "choices" || block.type === "explore_options") {
      interactive.push(block);
    } else if (block.type === "text" && /data last updated/i.test(block.content)) {
      freshness.push(block);
    } else {
      content.push(block);
    }
  }

  const ordered = [...content, ...interactive, ...freshness];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {ordered.map((block, i) => {
        const rendered = renderBlock(block, onChoiceSelect, onExploreSelect, onExploreGame, onCompareGames, choicesDisabled, dashboardGameIds);
        if (!rendered) return null;
        return <div key={i}>{rendered}</div>;
      })}
    </div>
  );
}
