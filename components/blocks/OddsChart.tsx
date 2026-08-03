"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T, S, buildPriceColors } from "@/lib/tokens";
import {
  displayName, ChartTooltip, CrossCursor,
  PricePill, LineSwatch,
  THRESHOLDS, DASH_PATTERNS, formatThreshold,
} from "@/lib/chartUtils";
import RangeSlider from "@/components/RangeSlider";
import type { OddsChartBlock } from "./types";

export default function OddsChart({ block, header }: { block: OddsChartBlock; header?: React.ReactNode }) {
  const { games } = block;
  const isSingle = games.length === 1;

  // Slider state: indices into THRESHOLDS (0–9)
  const [rangelow, setRangeLow] = useState(0);
  const [rangeHigh, setRangeHigh] = useState(THRESHOLDS.length - 1);

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
    const sliced = THRESHOLDS.slice(rangelow, rangeHigh + 1);
    if (isSingle) {
      return sliced.filter((t) => t <= games[0].top_prize_value);
    }
    return sliced;
  }, [games, isSingle, rangelow, rangeHigh]);

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

  const rangeLabel = `${formatThreshold(THRESHOLDS[rangelow])} – ${formatThreshold(THRESHOLDS[rangeHigh])}`;

  return (
    <div style={{ ...S.card, padding: "14px 16px 16px", display: "flex", flexDirection: "column", height: header ? 420 : 380 }}>
      {header}

      {/* Title (when no dashboard header) */}
      {!header && (
        <div style={{ ...S.sectionTitle, fontFamily: T.font }}>
          Win Probability by Amount
        </div>
      )}

      {/* Controls row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: T.sizeCaption, color: T.textTertiary, fontFamily: T.font, whiteSpace: "nowrap" }}>
          Prize range:{" "}
          <span style={{ color: T.textPrimary, fontWeight: T.weightLabel }}>{rangeLabel}</span>
        </span>
        <RangeSlider
          min={0}
          max={THRESHOLDS.length - 1}
          low={rangelow}
          high={rangeHigh}
          onChange={(lo, hi) => { setRangeLow(lo); setRangeHigh(hi); }}
          width={220}
        />
      </div>

      {/* Legend (multi-game only) */}
      {!isSingle && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginBottom: 8, paddingRight: 8 }}>
          {games.map((g, i) => (
            <div key={`${g.game_name}-${g.game_number}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <LineSwatch color={priceColors[g.price_tier] ?? "#999"} dashArray={lineStyles[i]} />
              <span style={{ fontSize: T.sizeSmall, color: T.textPrimary, fontFamily: T.font }}>
                {g.game_name}
                <span style={{ marginLeft: 3 }}>
                  (#{g.game_number})
                </span>
              </span>
              <PricePill price={g.price_tier} color={priceColors[g.price_tier]} />
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
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
    </div>
  );
}
