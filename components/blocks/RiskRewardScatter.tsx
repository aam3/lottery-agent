"use client";

import { useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { T, S, buildPriceColors } from "@/lib/tokens";
import { formatPrize, ChartTooltip } from "@/lib/chartUtils";
import type { RiskRewardScatterBlock } from "./types";

interface Props {
  block: RiskRewardScatterBlock;
  highlightedGameIds?: Set<number>;
}

export default function RiskRewardScatter({ block, highlightedGameIds, header, footer }: Props & { header?: React.ReactNode; footer?: React.ReactNode }) {
  const { games } = block;

  // Only render highlighted games (or all if no highlight set)
  const visibleGames = useMemo(() => {
    if (!highlightedGameIds) return games;
    return games.filter((g) => highlightedGameIds.has(g.game_id ?? -1));
  }, [games, highlightedGameIds]);

  const priceColors = useMemo(
    () => buildPriceColors([...new Set(visibleGames.map((g) => g.price_tier))]),
    [visibleGames],
  );

  // Compute axis domains from ALL games (full landscape), not just visible
  const zDomain = useMemo(() => {
    const vals = games.map((g) => g.avg_cash_prize).filter((v) => v > 0);
    if (vals.length === 0) return [0, 1] as [number, number];
    return [Math.min(...vals), Math.max(...vals)] as [number, number];
  }, [games]);

  const { xDomain, yDomain } = useMemo(() => {
    const xVals = games.map((g) => g.risk_scaled);
    const yVals = games.map((g) => g.reward_scaled);
    const xMin = Math.min(...xVals);
    const xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals);
    const yMax = Math.max(...yVals);
    const xPad = Math.max((xMax - xMin) * 0.15, 0.5);
    const yPad = Math.max((yMax - yMin) * 0.15, 0.5);
    return {
      xDomain: [Math.max(0, xMin - xPad), xMax + xPad] as [number, number],
      yDomain: [Math.max(0, yMin - yPad), yMax + yPad] as [number, number],
    };
  }, [games]);

  return (
    <div style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column" }}>
      {header}
      {/* Bubble size legend */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", paddingRight: 8, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: T.sizeCaption, color: T.textTertiary, fontFamily: T.font }}>Avg Cash Prize</span>
          {[
            { label: "$5", size: 5 }, { label: "$15", size: 8 },
            { label: "$30", size: 11 }, { label: "$60", size: 15 },
            { label: "$100+", size: 20 },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: item.size, height: item.size, borderRadius: "50%",
                background: T.textTertiary, opacity: 0.5,
              }} />
              <span style={{ fontSize: T.sizeCaption, color: T.textTertiary, fontFamily: T.font }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 24, left: 20 }}>
          <XAxis
            type="number" dataKey="risk_scaled" name="Risk"
            domain={xDomain} allowDataOverflow
            tickFormatter={(v: number) => v % 1 === 0 ? String(v) : v.toFixed(1)}
            tick={{ ...S.chartTick, fontFamily: T.font }} tickLine={false}
            label={{ value: "Risk", position: "bottom", offset: 8, ...S.chartAxisLabel, fontFamily: T.font }}
          />
          <YAxis
            type="number" dataKey="reward_scaled" name="Reward"
            domain={yDomain} allowDataOverflow
            tickFormatter={(v: number) => v % 1 === 0 ? String(v) : v.toFixed(1)}
            tick={{ ...S.chartTick, fontFamily: T.font }} tickLine={false}
            label={{ value: "Reward", angle: -90, position: "insideLeft", offset: -2, ...S.chartAxisLabel, fontFamily: T.font }}
            width={50}
          />
          <ZAxis type="number" dataKey="avg_cash_prize" domain={zDomain} range={[40, 400]} name="Avg Cash Prize" />
          <Tooltip
            cursor={S.chartCursor}
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const d = payload[0].payload as RiskRewardScatterBlock["games"][0];
              return (
                <ChartTooltip>
                  <div style={{ fontWeight: T.weightDisplay, fontFamily: T.font }}>{d.game_name}<span style={{ fontWeight: T.weightBody, color: "#aaa" }}> #{d.game_number}</span></div>
                  <div style={{ color: "#ccc", fontFamily: T.font }}>${d.price_tier} · Top Prize: {formatPrize(d.top_prize_value)}</div>
                  <div style={{ color: "#ccc", fontFamily: T.font }}>Reward: {d.reward_scaled.toFixed(1)} · Risk: {d.risk_scaled.toFixed(1)}</div>
                </ChartTooltip>
              );
            }}
          />
          <Scatter data={visibleGames} cursor="pointer">
            {visibleGames.map((g, i) => (
              <Cell
                key={i}
                fill={priceColors[g.price_tier] ?? "#999"}
                fillOpacity={0.85}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      </div>
      {footer}
    </div>
  );
}
