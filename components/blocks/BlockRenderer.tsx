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
  onExploreGame?: (gameName: string, gameNumber: string) => void;
  onCompareGames?: (gameIds: number[]) => void;
  choicesDisabled?: boolean;
}

function renderBlock(
  block: Block,
  onChoiceSelect?: (choice: string, prompt: string) => void,
  onExploreSelect?: (option: string) => void,
  onExploreGame?: (gameName: string, gameNumber: string) => void,
  onCompareGames?: (gameIds: number[]) => void,
  choicesDisabled?: boolean,
) {
  switch (block.type) {
    case "text":
      return <TextBlock block={block} />;
    case "game_stats_summary":
      return <GameStatsSummary block={block} onExplore={onExploreGame} disabled={choicesDisabled} />;
    case "odds_chart":
      return <OddsChart block={block} />;
    case "comparison_table":
      return <ComparisonTable block={block} onCompare={onCompareGames} disabled={choicesDisabled} />;
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
}: BlockRendererProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {blocks.map((block, i) => {
        const rendered = renderBlock(block, onChoiceSelect, onExploreSelect, onExploreGame, onCompareGames, choicesDisabled);
        if (!rendered) return null;
        return <div key={i}>{rendered}</div>;
      })}
    </div>
  );
}
