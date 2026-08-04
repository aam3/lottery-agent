"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T, S, buildPriceColors } from "@/lib/tokens";
import {
  displayName, ChartTooltip, CrossCursor,
  PricePill, LineSwatch,
  THRESHOLDS, DASH_PATTERNS, formatThreshold,
} from "@/lib/chartUtils";
import type { OddsChartBlock } from "./types";

export default function OddsChart({ block, header, footer }: { block: OddsChartBlock; header?: React.ReactNode; footer?: React.ReactNode }) {
  const { games } = block;
  const isSingle = games.length === 1;

  const priceColors = useMemo(
    () => buildPriceColors([...new Set(games.map((g) => g.price_tier))]),
    [games],
  );

  const lineStyles = useMemo(() => {
    const tierCount: Record<number, number> = {};
    return games.map((g) => {
      const idx = tierCount[g.price_tier] ?? 0;
      tierCount[g.price_tier] = idx + 1;
      return idx === 0 ? "0" : DASH_PATTERNS[idx] ?? DASH_PATTERNS[DASH_PATTERNS.length - 1];
    });
  }, [games]);

  const filteredThresholds = useMemo(() => {
    if (isSingle) {
      return THRESHOLDS.filter((t) => t <= games[0].top_prize_value);
    }
    return THRESHOLDS;
  }, [games, isSingle]);

  // Use game_number as dataKey (safe for Recharts property lookup — no special chars)
  const lineData = useMemo(
    () =>
      filteredThresholds.map((t) => {
        const point: Record<string, number | string> = { threshold: formatThreshold(t) };
        games.forEach((g) => {
          point[g.game_number] = g.marginal_odds[String(t)] ?? 0;
        });
        return point;
      }),
    [games, filteredThresholds],
  );

  return (
    <div style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", height: header ? 380 : 340 }}>
      {header}

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {/* Legend (multi-game only) — overlaid on top-right of chart area */}
        {!isSingle && (
          <div style={{
            position: "absolute", top: 4, right: 12, zIndex: 1,
            display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
            background: "rgba(255,255,255,0.9)", borderRadius: T.smallRadius, padding: "6px 8px",
          }}>
            {games.map((g, i) => (
              <div key={`${g.game_name}-${g.game_number}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <LineSwatch color={priceColors[g.price_tier] ?? "#999"} dashArray={lineStyles[i]} />
                <span style={{ fontSize: T.sizeSmall, fontWeight: T.weightLabel, color: T.textPrimary, fontFamily: T.font }}>
                  {g.game_name}
                  <span style={{ fontSize: T.sizeCaption, fontWeight: T.weightBody, color: T.textTertiary, marginLeft: 3 }}>
                    (#{g.game_number})
                  </span>
                </span>
                <PricePill price={g.price_tier} color={priceColors[g.price_tier]} />
              </div>
            ))}
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineData} margin={{ top: 8, right: 12, bottom: 28, left: 20 }}>
            <XAxis
              dataKey="threshold"
              tick={{ ...S.chartTick, fontFamily: T.font }} tickLine={false}
              label={{ value: isSingle ? "Minimum Win Amount" : "Win Amount", position: "bottom", offset: 10, ...S.chartAxisLabel, fontFamily: T.font }}
            />
            <YAxis
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ ...S.chartTick, fontFamily: T.font }} tickLine={false}
              label={{ value: "Probability", angle: -90, position: "insideLeft", offset: -2, ...S.chartAxisLabel, fontFamily: T.font }}
              width={55}
            />
            <Tooltip
              cursor={<CrossCursor />}
              content={({ payload, label }) => {
                if (!payload || payload.length === 0) return null;
                if (isSingle) {
                  const val = payload[0].value as number;
                  return (
                    <ChartTooltip>
                      <div style={{ fontWeight: T.weightLabel, marginBottom: 2, fontFamily: T.font }}>Win {label}</div>
                      <div style={{ fontFamily: T.font }}>{(val * 100).toFixed(2)}%</div>
                    </ChartTooltip>
                  );
                }
                return (
                  <ChartTooltip>
                    <div style={{ fontWeight: T.weightDisplay, marginBottom: 4, fontFamily: T.font }}>Win {label}+</div>
                    {payload.map((p) => (
                      <div key={p.dataKey as string} style={{ color: "#ccc", fontFamily: T.font }}>
                        <span style={{ color: p.color }}>{"\u25CF"} </span>
                        {p.name}: {((p.value as number) * 100).toFixed(2)}%
                      </div>
                    ))}
                  </ChartTooltip>
                );
              }}
            />
            {games.map((g, i) => (
              <Line
                key={g.game_number}
                type="monotone"
                dataKey={g.game_number}
                name={displayName(g)}
                stroke={isSingle ? T.accent : (priceColors[g.price_tier] ?? "#999")}
                strokeWidth={2}
                strokeDasharray={isSingle ? undefined : (lineStyles[i] === "0" ? undefined : lineStyles[i])}
                dot={{ r: 3, fill: isSingle ? T.accent : (priceColors[g.price_tier] ?? "#999") }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {footer}
    </div>
  );
}
