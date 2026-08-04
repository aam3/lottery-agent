"use client";

import { T, S, OUTCOME_COLORS, buildPriceColors } from "@/lib/tokens";
import { PricePill } from "@/lib/chartUtils";
import type { OutcomeBarsBlock } from "./types";

export default function OutcomeBars({ block, header, footer }: { block: OutcomeBarsBlock; header?: React.ReactNode; footer?: React.ReactNode }) {
  const { games } = block;
  const priceColors = buildPriceColors([...new Set(games.map((g) => g.price_tier))]);

  return (
    <div style={{ ...S.card, padding: 20 }}>
      {header || (
        <div style={{ ...S.sectionTitle, fontFamily: T.font, marginBottom: 16 }}>
          Outcome Breakdown
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {games.map((game) => {
          const segments = [
            { key: "win", label: "Win", pct: game.p_winning_cash * 100, color: OUTCOME_COLORS.win },
            { key: "even", label: "Break Even", pct: game.p_breaking_even * 100, color: OUTCOME_COLORS.even },
            { key: "lose", label: "Lose", pct: game.p_losing * 100, color: OUTCOME_COLORS.lose },
          ];

          return (
            <div key={`${game.game_name}-${game.game_number}`}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: 8,
              }}>
                <span style={{ fontSize: T.sizeSmall, fontWeight: T.weightLabel, color: T.textPrimary, fontFamily: T.font }}>
                  {game.game_name}
                </span>
                <span style={{ fontSize: T.sizeCaption, color: T.textTertiary, fontFamily: T.font }}>
                  (#{game.game_number})
                </span>
                <PricePill price={game.price_tier} color={priceColors[game.price_tier]} />
              </div>
              {/* Stacked bar */}
              <div style={{
                display: "flex", height: 10, borderRadius: 5, overflow: "hidden",
                background: T.divider,
              }}>
                {segments.map((seg) =>
                  seg.pct > 0 ? (
                    <div
                      key={seg.key}
                      style={{
                        width: `${seg.pct}%`,
                        height: "100%",
                        background: seg.color,
                      }}
                    />
                  ) : null
                )}
              </div>
              {/* Legend row */}
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                {segments.map((seg) => (
                  <div key={seg.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: seg.color, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: T.sizeCaption, color: T.textSecondary, fontFamily: T.font }}>
                      {seg.label} {seg.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
