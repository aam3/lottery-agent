export interface TextBlock {
  type: "text";
  content: string;
}

export interface GameStatsSummaryBlock {
  type: "game_stats_summary";
  game_name: string;
  game_number: string;
  game_id?: number;
  image_url: string | null;
  metrics: { label: string; value: string; suffix?: string }[];
  explorable?: boolean;
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
  columns: { label: string }[];
  rows: { label: string; price_tier?: number; values: string[] }[];
  explorable?: boolean;
  game_ids?: number[];
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

export interface ChoicesBlock {
  type: "choices";
  prompt: string;
  options: string[];
}

export interface ExploreOptionsBlock {
  type: "explore_options";
  options: string[];
}

export interface RecentBigWinsBlock {
  type: "recent_big_wins";
  game_name: string;
  game_number: string;
  wins: { date: string; prize: string; claimed: number }[];
}

export interface OutcomeBarsBlock {
  type: "outcome_bars";
  games: {
    game_name: string;
    game_number: string;
    price_tier: number;
    p_losing: number;
    p_breaking_even: number;
    p_winning_cash: number;
  }[];
}

export type Block =
  | TextBlock
  | GameStatsSummaryBlock
  | OddsChartBlock
  | ComparisonTableBlock
  | DepletionBarsBlock
  | RiskRewardScatterBlock
  | ChoicesBlock
  | ExploreOptionsBlock
  | RecentBigWinsBlock
  | OutcomeBarsBlock;
