"use client";

import { useState } from "react";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import type { DashboardData } from "@/components/dashboard/DashboardPanel";
import { T } from "@/lib/tokens";

// ─── Mock data matching real API response shape ────────────────────────────

const MOCK_DASHBOARD_2_GAMES: DashboardData = {
  games: [
    { gameId: 1, gameName: "Gold Rush", gameNumber: "1501", priceTier: 5, imageUrl: null },
    { gameId: 3, gameName: "Diamond Dazzle", gameNumber: "1523", priceTier: 10, imageUrl: null },
  ],
  statsTable: {
    columns: [
      { label: "Top Prize" },
      { label: "Win Rate" },
      { label: "Odds $500+" },
      { label: "ROI" },
    ],
    rows: [
      { label: "Gold Rush (#1501)", priceTier: 5, values: ["$500K", "32.5%", "0.012%", "-12.3%"] },
      { label: "Diamond Dazzle (#1523)", priceTier: 10, values: ["$1M", "38.0%", "0.040%", "-8.1%"] },
    ],
  },
  oddsChart: {
    games: [
      {
        game_name: "Gold Rush", game_number: "1501", price_tier: 5, top_prize_value: 500000,
        marginal_odds: { "0": 0.325, "10": 0.28, "50": 0.065, "100": 0.018, "500": 0.00012, "1000": 0.00005, "5000": 0.000008, "10000": 0.000003, "50000": 0.0000008, "100000": 0.0000002 },
      },
      {
        game_name: "Diamond Dazzle", game_number: "1523", price_tier: 10, top_prize_value: 1000000,
        marginal_odds: { "0": 0.38, "10": 0.32, "50": 0.09, "100": 0.035, "500": 0.0004, "1000": 0.00015, "5000": 0.00002, "10000": 0.000008, "50000": 0.000002, "100000": 0.0000005 },
      },
    ],
  },
  outcomeBars: {
    games: [
      { game_name: "Gold Rush", game_number: "1501", price_tier: 5, p_losing: 0.675, p_breaking_even: 0.10, p_winning_cash: 0.225 },
      { game_name: "Diamond Dazzle", game_number: "1523", price_tier: 10, p_losing: 0.62, p_breaking_even: 0.12, p_winning_cash: 0.26 },
    ],
  },
  scatter: {
    highlighted: [
      { game_name: "Gold Rush", game_number: "1501", price_tier: 5, risk_scaled: 3.2, reward_scaled: 6.8, avg_cash_prize: 45, top_prize_value: 500000 },
      { game_name: "Diamond Dazzle", game_number: "1523", price_tier: 10, risk_scaled: 5.5, reward_scaled: 7.9, avg_cash_prize: 88, top_prize_value: 1000000 },
    ],
    context: [
      { game_name: "Lucky 7s", game_number: "1489", price_tier: 5, risk_scaled: 4.1, reward_scaled: 5.2, avg_cash_prize: 32, top_prize_value: 250000 },
      { game_name: "Super Crossword", game_number: "1480", price_tier: 5, risk_scaled: 2.8, reward_scaled: 5.9, avg_cash_prize: 28, top_prize_value: 100000 },
      { game_name: "Cash Blast", game_number: "1510", price_tier: 10, risk_scaled: 6.2, reward_scaled: 6.1, avg_cash_prize: 55, top_prize_value: 500000 },
    ],
  },
};

const MOCK_DASHBOARD_1_GAME: DashboardData = {
  games: [
    { gameId: 1, gameName: "Gold Rush", gameNumber: "1501", priceTier: 5, imageUrl: null },
  ],
  statsTable: {
    columns: [
      { label: "Top Prize" },
      { label: "Win Rate" },
      { label: "Odds $500+" },
      { label: "ROI" },
    ],
    rows: [
      { label: "Gold Rush (#1501)", priceTier: 5, values: ["$500K", "32.5%", "0.012%", "-12.3%"] },
    ],
  },
  oddsChart: {
    games: [
      {
        game_name: "Gold Rush", game_number: "1501", price_tier: 5, top_prize_value: 500000,
        marginal_odds: { "0": 0.325, "10": 0.28, "50": 0.065, "100": 0.018, "500": 0.00012, "1000": 0.00005, "5000": 0.000008, "10000": 0.000003, "50000": 0.0000008, "100000": 0.0000002 },
      },
    ],
  },
  outcomeBars: {
    games: [
      { game_name: "Gold Rush", game_number: "1501", price_tier: 5, p_losing: 0.675, p_breaking_even: 0.10, p_winning_cash: 0.225 },
    ],
  },
  scatter: {
    highlighted: [
      { game_name: "Gold Rush", game_number: "1501", price_tier: 5, risk_scaled: 3.2, reward_scaled: 6.8, avg_cash_prize: 45, top_prize_value: 500000 },
    ],
    context: [
      { game_name: "Lucky 7s", game_number: "1489", price_tier: 5, risk_scaled: 4.1, reward_scaled: 5.2, avg_cash_prize: 32, top_prize_value: 250000 },
      { game_name: "Super Crossword", game_number: "1480", price_tier: 5, risk_scaled: 2.8, reward_scaled: 5.9, avg_cash_prize: 28, top_prize_value: 100000 },
      { game_name: "20X", game_number: "1475", price_tier: 5, risk_scaled: 3.8, reward_scaled: 4.5, avg_cash_prize: 22, top_prize_value: 200000 },
    ],
  },
};

export default function TestDashboard() {
  const [scenario, setScenario] = useState<"empty" | "loading" | "1game" | "2games">("2games");

  const mode = scenario === "empty" ? "empty" as const
    : scenario === "loading" ? "loading" as const
    : "active" as const;

  const data = scenario === "1game" ? MOCK_DASHBOARD_1_GAME
    : scenario === "2games" ? MOCK_DASHBOARD_2_GAMES
    : null;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: T.font }}>
      {/* Scenario picker */}
      <div style={{
        padding: "12px 24px",
        borderBottom: `1px solid ${T.divider}`,
        background: T.cardBg,
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}>
        <span style={{ fontSize: T.sizeSmall, color: T.textSecondary, marginRight: 8 }}>
          Dashboard test:
        </span>
        {(["empty", "loading", "1game", "2games"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            style={{
              padding: "4px 12px",
              borderRadius: T.pillRadius,
              border: `1px solid ${scenario === s ? T.accent : T.border}`,
              background: scenario === s ? T.accent : T.cardBg,
              color: scenario === s ? "#fff" : T.textPrimary,
              fontSize: T.sizeSmall,
              fontFamily: T.font,
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <DashboardPanel
          mode={mode}
          data={data}
          onRemoveGame={(id) => console.log("Remove game:", id)}
          onAskAbout={(visual) => console.log("Ask about:", visual)}
        />
      </div>
    </div>
  );
}
