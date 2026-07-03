export interface TextBlock {
  type: "text";
  content: string;
}

export interface GameStatsSummaryBlock {
  type: "game_stats_summary";
  game_name: string;
  game_number: string;
  image_url: string | null;
  metrics: { label: string; value: string; suffix?: string }[];
}

export interface OddsChartBlock {
  type: "odds_chart";
  games: {
    game_name: string;
    game_number: string;
    price_tier: number;
    top_prize_value: number;
    marginal_odds: Record<string, number>;
  }[];
}

export interface ComparisonTableBlock {
  type: "comparison_table";
  games: { game_name: string; game_number: string; price_tier: number }[];
  rows: { label: string; values: string[] }[];
}

export interface DepletionBarsBlock {
  type: "depletion_bars";
  game_name: string;
  game_number: string;
  bands: { name: string; range: string; pct: number }[];
}

export interface RiskRewardScatterBlock {
  type: "risk_reward_scatter";
  games: {
    game_name: string;
    game_number: string;
    price_tier: number;
    risk_scaled: number;
    reward_scaled: number;
    avg_cash_prize: number;
    top_prize_value: number;
  }[];
}

export type Block =
  | TextBlock
  | GameStatsSummaryBlock
  | OddsChartBlock
  | ComparisonTableBlock
  | DepletionBarsBlock
  | RiskRewardScatterBlock;
