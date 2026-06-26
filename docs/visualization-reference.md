# ScratchSmart Visualization Reference

Portable reference for recreating all chart/visualization components. Includes full source code, data input mappings, and the design system needed to render them identically.

**Charting library:** Recharts ^3.8.1 (React)
**Font:** Outfit (Google Fonts, `'Outfit', sans-serif`)
**Styling approach:** Inline styles via design tokens (no CSS files). Tailwind used only for layout utilities.

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Shared Utilities](#2-shared-utilities)
3. [Risk-Reward Scatter Plot](#3-risk-reward-scatter-plot)
4. [Prize Odds Profile — Multi-Game (Comparison)](#4-prize-odds-profile--multi-game-comparison)
5. [Comparison Table](#5-comparison-table)
6. [Prize Odds Profile — Single Game (Detail Page)](#6-prize-odds-profile--single-game-detail-page)
7. [Prize Depletion Bars (Detail Page)](#7-prize-depletion-bars-detail-page)
8. [Recent Big Wins Table (Detail Page)](#8-recent-big-wins-table-detail-page)

---

## 1. Design System

### tokens.ts

```ts
export const T = {
  // Font
  font: "'Outfit', sans-serif",

  // Type scale
  sizePageTitle: 24,
  sizeDisplay: 20,
  sizeTitle: 16,
  sizeBody: 13,
  sizeSmall: 12,
  sizeLabel: 11,
  sizeCaption: 10,

  // Weights
  weightPageTitle: 500,
  weightDisplay: 600,
  weightTitle: 500,
  weightBody: 400,
  weightSmall: 400,
  weightLabel: 500,
  weightCategory: 600,
  weightCaption: 400,

  // Line heights
  lhPageTitle: 1.25,
  lhDisplay: 1.2,
  lhTitle: 1.3,
  lhBody: 1.55,
  lhSmall: 1.5,
  lhLabel: 1.3,
  lhCaption: 1.5,

  // Text colors — three-tier hierarchy
  textPrimary: "#2c2924",
  textSecondary: "#8a8176",
  textTertiary: "#918779",

  // Surface colors
  pageBg: "#f7f3e8",
  cardBg: "#ffffff",
  pickBg: "#fbf9f1",
  accent: "#3949AB",
  border: "#d8d0bc",
  divider: "#e8e2d2",
  cardRadius: 10,
  cardShadow: "0 2px 6px rgba(0,0,0,0.04)",
  dropdownShadow: "0 4px 12px rgba(0,0,0,0.1)",
  tooltipBg: "rgba(0,0,0,0.85)",
  badgeBg: "#f0ede6",
  badgeText: "#2c2924",
  badgeBorder: "#c8c3b8",
  hoverBg: "#f7f3e8",
  smallRadius: 6,
  pillRadius: 10,
  modalRadius: 14,
  modalShadow: "0 12px 40px rgba(0,0,0,0.15)",
} as const;

export const PRICE_COLORS: Record<number, string> = {
  1: "#FFD21F",
  2: "#E8692E",
  3: "#77BBDA",
  5: "#7986CB",
  10: "#283593",
  20: "#9B377E",
  25: "#C2185B",
  30: "#880E4F",
};

export const OUTCOME_COLORS = {
  lose: "#FF787B",
  even: "#FFE787",
  win: "#18C284",
} as const;

// Composed style patterns
export const S = {
  card: {
    background: T.cardBg,
    borderRadius: T.cardRadius,
    boxShadow: T.cardShadow,
  },
  tooltip: {
    background: T.tooltipBg,
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 12,
    color: "#fff" as const,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: T.sizeTitle,
    fontWeight: T.weightTitle,
    color: T.textPrimary,
    lineHeight: T.lhTitle,
  },
  metricLabel: {
    fontSize: T.sizeCaption,
    fontWeight: T.weightLabel,
    color: T.textSecondary,
    letterSpacing: 0.5,
  },
  chartTick: {
    fontSize: T.sizeLabel,
    fill: T.textSecondary,
  },
  chartAxisLabel: {
    fontSize: T.sizeSmall,
    fill: T.textSecondary,
  },
  chartCursor: {
    stroke: T.textTertiary,
    strokeDasharray: "4 4",
  },
} as const;
```

### PricePill component

Used in comparison table headers to show the game's price tier.

```tsx
export function PricePill({ price }: { price: number }) {
  return (
    <span style={{
      fontSize: T.sizeCaption,
      fontWeight: T.weightCategory,
      color: "#fff",
      background: PRICE_COLORS[price] ?? "#999",
      borderRadius: T.pillRadius,
      padding: "1px 7px",
      lineHeight: 1.4,
      flexShrink: 0,
    }}>
      ${price}
    </span>
  );
}
```

---

## 2. Shared Utilities

### Format functions

```ts
export function formatPrice(n: number): string {
  return `$${n}`;
}

export function formatPrize(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function displayName(game: { game_name: string; game_number: string }): string {
  return game.game_number ? `${game.game_name} (#${game.game_number})` : game.game_name;
}
```

### ChartTooltip + CrossCursor

```tsx
import type { ReactNode } from "react";

export function ChartTooltip({ children }: { children: ReactNode }) {
  return <div style={S.tooltip}>{children}</div>;
}

export function CrossCursor({ points, width, height }: {
  points?: { x: number; y: number }[];
  width?: number;
  height?: number;
}) {
  if (!points || points.length === 0 || !width || !height) return null;
  const { x, y } = points[0];
  const style = { stroke: T.textTertiary, strokeDasharray: "4 4", strokeWidth: 1 };
  return (
    <g>
      <line x1={x} y1={0} x2={x} y2={height} {...style} />
      <line x1={0} y1={y} x2={width} y2={y} {...style} />
    </g>
  );
}
```

### RangeSlider

Used in the comparison Prize Odds Profile to filter win-amount thresholds.

```tsx
"use client";
import { useCallback, useRef, useState } from "react";

const THUMB = {
  width: 14, height: 14, borderRadius: "50%",
  background: T.accent,
  border: "2px solid #fff",
  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
  pointerEvents: "none" as const, zIndex: 2,
} as const;

const TRACK = {
  position: "absolute" as const, left: 0, right: 0, top: "50%", transform: "translateY(-50%)",
  height: 4, borderRadius: 2, background: "#e0dcd4",
} as const;

export function RangeSlider({
  min, max, low, high, onLowChange, onHighChange, width,
}: {
  min: number; max: number; low: number; high: number;
  onLowChange: (v: number) => void; onHighChange: (v: number) => void;
  width?: number | string;
}) {
  const range = max - min || 1;
  const lowPct = ((low - min) / range) * 100;
  const highPct = ((high - min) / range) * 100;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"low" | "high" | null>(null);

  const valueFromPointer = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return low;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + pct * range);
  }, [min, range, low]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const v = valueFromPointer(e.clientX);
    const distToLow = Math.abs(v - low);
    const distToHigh = Math.abs(v - high);
    const target = distToLow <= distToHigh ? "low" : "high";
    setDragging(target);
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    if (target === "low") {
      const clamped = Math.min(v, high - 1);
      if (clamped >= min) onLowChange(clamped);
    } else {
      const clamped = Math.max(v, low + 1);
      if (clamped <= max) onHighChange(clamped);
    }
  }, [valueFromPointer, low, high, min, max, onLowChange, onHighChange]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const v = valueFromPointer(e.clientX);
    if (dragging === "low") onLowChange(Math.max(min, Math.min(v, high - 1)));
    else onHighChange(Math.min(max, Math.max(v, low + 1)));
  }, [dragging, valueFromPointer, low, high, min, max, onLowChange, onHighChange]);

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(null)}
      style={{
        position: "relative", width: width ?? "100%", height: 20,
        display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none",
      }}
    >
      <div style={TRACK} />
      <div style={{
        position: "absolute", left: `${lowPct}%`, top: "50%", transform: "translateY(-50%)",
        width: `${highPct - lowPct}%`, height: 4, borderRadius: 2, background: T.accent,
      }} />
      <div style={{ position: "absolute", left: `calc(${lowPct}% - 7px)`, top: "50%", transform: "translateY(-50%)", ...THUMB }} />
      <div style={{ position: "absolute", left: `calc(${highPct}% - 7px)`, top: "50%", transform: "translateY(-50%)", ...THUMB }} />
    </div>
  );
}
```

---

## 3. Risk-Reward Scatter Plot

**What it shows:** Bubble chart of all games. X = Risk, Y = Reward, bubble size = average cash prize. Color = price tier. Supports selection highlighting and hover states.

### Data Inputs

| Field | Source | Description |
|-------|--------|-------------|
| `risk_scaled` | **Computed** by score engine (`01-score-engine/compute-scaled-scores.ts`). Derived from `risk_raw`, which is computed from `prizes` table (`prize_value`, `prizes_remaining`, `is_free_ticket`) and `games.price_tier`. | Scaled risk score (0–10 range, min-max normalized across all games in state) |
| `reward_scaled` | **Computed** by score engine. Derived from `reward_raw`. | Scaled reward score (0–10 range) |
| `avg_cash_prize` | **Computed** in `02-data-api/service.ts`. Weighted average of `prizes.prize_value` for cash-winning tiers (`prize_value > price_tier` and `!is_free_ticket`), weighted by `prizes.prizes_remaining`. | Drives bubble size via ZAxis `range={[40, 400]}` |
| `price_tier` | `games.price_tier` | Ticket price ($1–$30). Maps to `PRICE_COLORS` for bubble fill color |
| `game_id` | `games.game_id` | Unique identifier, used for selection state |
| `game_name` | `games.game_name` | Tooltip display |
| `game_number` | `games.game_number` | Tooltip display |
| `top_prize_value` | **Computed** in service. Highest `prizes.prize_value` where `prizes_remaining > 0` | Tooltip display |
| `value_score` | **Computed** by score engine | Tooltip display |

### Component Code

```tsx
"use client";
import { useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { Game } from "@/lib/types";

export function RiskRewardChart({
  games, selectedIds, hoveredGameId, onToggleSelect,
}: {
  games: Game[];
  selectedIds: Set<number>;
  hoveredGameId?: number | null;
  onToggleSelect: (id: number) => void;
}) {
  const { xDomain, yDomain } = useMemo(() => {
    if (games.length === 0) return { xDomain: [0, 1] as [number, number], yDomain: [0, 1] as [number, number] };
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
    <div style={{ ...S.card, padding: "16px 12px 16px", display: "flex", flexDirection: "column", gap: 8, height: "100%", boxSizing: "border-box" }}>
      {/* Bubble size legend */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", paddingLeft: 4, paddingRight: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: T.sizeCaption, color: T.textTertiary }}>Avg Cash Prize</span>
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
              <span style={{ fontSize: T.sizeCaption, color: T.textTertiary }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 24, left: 20 }}>
          <XAxis
            type="number" dataKey="risk_scaled" name="Risk"
            domain={xDomain} allowDataOverflow
            tickFormatter={(v: number) => v % 1 === 0 ? String(v) : v.toFixed(1)}
            tick={S.chartTick} tickLine={false}
            label={{ value: "Risk (raw $)", position: "bottom", offset: 8, ...S.chartAxisLabel }}
          />
          <YAxis
            type="number" dataKey="reward_scaled" name="Reward"
            domain={yDomain} allowDataOverflow
            tickFormatter={(v: number) => v % 1 === 0 ? String(v) : v.toFixed(1)}
            tick={S.chartTick} tickLine={false}
            label={{ value: "Reward (raw $)", angle: -90, position: "insideLeft", offset: -2, ...S.chartAxisLabel }}
            width={50}
          />
          <ZAxis type="number" dataKey="avg_cash_prize" range={[40, 400]} name="Avg Cash Prize" />
          <Tooltip
            cursor={S.chartCursor}
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const d = payload[0].payload as Game;
              return (
                <ChartTooltip>
                  <div style={{ fontWeight: T.weightDisplay }}>{d.game_name}{d.game_number && <span style={{ fontWeight: T.weightBody, color: "#aaa" }}> #{d.game_number}</span>}</div>
                  <div style={{ color: "#ccc" }}>${d.price_tier} · Top Prize: {formatPrize(d.top_prize_value)}</div>
                  <div style={{ color: "#ccc" }}>Reward: {d.reward_scaled.toFixed(1)} · Risk: {d.risk_scaled.toFixed(1)}</div>
                  <div style={{ color: "#ccc" }}>Value: {d.value_score.toFixed(1)}</div>
                </ChartTooltip>
              );
            }}
          />
          <Scatter data={games} cursor="pointer" onClick={(data: unknown) => onToggleSelect((data as Game).game_id)}>
            {games.map((g) => {
              const isSelected = selectedIds.has(g.game_id);
              const isHovered = hoveredGameId === g.game_id;
              const hasSel = selectedIds.size > 0;
              const isFaded = hasSel && !isSelected && !isHovered;
              return (
                <Cell
                  key={g.game_id}
                  fill={PRICE_COLORS[g.price_tier] ?? "#999"}
                  fillOpacity={isFaded ? 0.2 : 0.85}
                  stroke={isSelected ? T.accent : isHovered ? T.textPrimary : "rgba(255,255,255,0.35)"}
                  strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1}
                />
              );
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 4. Prize Odds Profile — Multi-Game (Comparison)

**What it shows:** Line chart overlaying multiple games' probability of winning at least X dollars. Each line is colored by price tier, with dash patterns to differentiate games within the same tier. Includes RangeSlider to filter the threshold range.

### Data Inputs

| Field | Source | Description |
|-------|--------|-------------|
| `marginal_odds` | **Computed** by score engine (`01-score-engine/probabilities.ts`). For each threshold T, probability of winning >= $T on a single ticket. Built from `prizes.prize_value`, `prizes.prizes_remaining`, and estimated losing tickets. | `Record<number, number>` — keys are dollar thresholds, values are probabilities (0–1) |
| `p_losing` | **Computed** by score engine. Probability of winning nothing. | Used for the "Any" (threshold=0) data point: `1 - p_losing` |
| `price_tier` | `games.price_tier` | Line color via `PRICE_COLORS` |
| `game_name` | `games.game_name` | Line label / legend key |
| `game_number` | `games.game_number` | Line label |

### Thresholds & Formatting

```ts
const THRESHOLDS = [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];
const DASH_PATTERNS = ["0", "8 4", "2 4", "8 4 2 4"];

function formatThreshold(v: number) {
  if (v === 0) return "Any";
  if (v >= 100000) return "$100K+";
  if (v >= 50000) return "$50K+";
  if (v >= 10000) return "$10K+";
  if (v >= 5000) return "$5K+";
  if (v >= 1000) return "$1K+";
  return `$${v}+`;
}
```

### Line style assignment

Games sharing a price tier get differentiated by dash pattern. First game in a tier = solid, second = `8 4`, third = `2 4`, etc.

```ts
const lineStyles = useMemo(() => {
  const tierCount: Record<number, number> = {};
  return games.map((g) => {
    const idx = tierCount[g.price_tier] ?? 0;
    tierCount[g.price_tier] = idx + 1;
    return idx === 0 ? "0" : DASH_PATTERNS[idx] ?? DASH_PATTERNS[DASH_PATTERNS.length - 1];
  });
}, [games]);
```

### LineSwatch (legend element)

```tsx
function LineSwatch({ color, dashArray }: { color: string; dashArray: string }) {
  return (
    <svg width={40} height={12} style={{ display: "block" }}>
      <line
        x1={0} y1={6} x2={40} y2={6}
        stroke={color} strokeWidth={2.5}
        strokeDasharray={dashArray === "0" ? undefined : dashArray}
        strokeLinecap="round"
      />
    </svg>
  );
}
```

### Data transformation

```ts
const lineData = useMemo(() =>
  filteredThresholds.map((t) => {
    const point: Record<string, number | string> = { threshold: formatThreshold(t) };
    games.forEach((g) => {
      point[displayName(g)] = t === 0 ? (1 - g.p_losing) : (g.marginal_odds[t] ?? 0);
    });
    return point;
  }),
[games, filteredThresholds]);
```

### Chart rendering

```tsx
<ResponsiveContainer width="100%" height="100%">
  <LineChart data={lineData} margin={{ top: 8, right: 12, bottom: 28, left: 20 }}>
    <XAxis
      dataKey="threshold"
      tick={S.chartTick} tickLine={false}
      label={{ value: "Win Amount", position: "bottom", offset: 10, ...S.chartAxisLabel }}
    />
    <YAxis
      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
      tick={S.chartTick} tickLine={false}
      label={{ value: "Probability", angle: -90, position: "insideLeft", offset: -2, ...S.chartAxisLabel }}
      width={55}
    />
    <Tooltip
      cursor={<CrossCursor />}
      content={({ payload, label }) => {
        if (!payload || payload.length === 0) return null;
        return (
          <ChartTooltip>
            <div style={{ fontWeight: T.weightDisplay, marginBottom: 4 }}>Win {label}+</div>
            {payload.map((p) => (
              <div key={p.dataKey as string} style={{ color: "#ccc" }}>
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
        key={g.game_id}
        type="monotone"
        dataKey={displayName(g)}
        stroke={PRICE_COLORS[g.price_tier] ?? "#999"}
        strokeWidth={2}
        strokeDasharray={lineStyles[i] === "0" ? undefined : lineStyles[i]}
        dot={{ r: 3, fill: PRICE_COLORS[g.price_tier] ?? "#999" }}
        activeDot={{ r: 5 }}
      />
    ))}
  </LineChart>
</ResponsiveContainer>
```

---

## 5. Comparison Table

**What it shows:** Side-by-side metrics table for 2+ selected games. Rows: Top Prize, Overall Odds, Odds $500+, Value Score (with inline bar chart).

### Data Inputs

| Field | Source | Description |
|-------|--------|-------------|
| `top_prize_value` | **Computed** in `02-data-api/service.ts`. Highest `prizes.prize_value` where `prizes.prizes_remaining > 0` | Displayed as formatted prize string |
| `top_prize_remaining` | **Computed** in service. Sum of `prizes.prizes_remaining` for the top prize tier | Shown as "X left" subtitle |
| `p_losing` | **Computed** by score engine | Overall odds: `((1 - p_losing) * 100).toFixed(3) + "%"` |
| `marginal_odds[500]` | **Computed** by score engine | Odds of winning >= $500 |
| `value_score` | **Computed** by score engine (`compute-scaled-scores.ts`) | 0–100 composite score. Rendered as inline bar + number |
| `price_tier` | `games.price_tier` | Column header PricePill color |
| `game_name` | `games.game_name` | Column header |
| `game_number` | `games.game_number` | Column header subtitle |

### Row definitions

```ts
const tableRows = useMemo(() => [
  { label: "TOP PRIZE", values: games.map((g) => ({
    main: formatPrize(g.top_prize_value), sub: `${g.top_prize_remaining} left`
  })) },
  { label: "OVERALL ODDS", values: games.map((g) => ({
    main: ((1 - g.p_losing) * 100).toFixed(3) + "%"
  })) },
  { label: "ODDS $500+", values: games.map((g) => {
    const p = g.marginal_odds[500];
    if (!p || p <= 0) return { main: "\u2014" };
    return { main: (p * 100).toFixed(3) + "%" };
  }) },
  { label: "VALUE SCORE", values: games.map((g) => ({
    main: "__bar__", score: g.value_score
  })) },
], [games]);
```

### Table rendering

```tsx
<div style={{ ...S.card, flexShrink: 0, overflow: "hidden" }}>
  <table style={{
    width: "100%", borderCollapse: "collapse",
    fontFamily: T.font, fontSize: T.sizeSmall,
  }}>
    <thead>
      <tr>
        <th style={{
          textAlign: "left", padding: "10px 14px",
          borderBottom: `1px solid ${T.divider}`, width: 100,
        }} />
        {games.map((g, i) => (
          <th key={g.game_id} style={{
            textAlign: "center", padding: "10px 14px",
            borderBottom: `1px solid ${T.divider}`, fontWeight: T.weightTitle,
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <LineSwatch
                color={PRICE_COLORS[g.price_tier] ?? "#999"}
                dashArray={lineStyles[i]}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>{g.game_name}{g.game_number && <span style={{
                  fontSize: T.sizeCaption, color: T.textTertiary, fontWeight: T.weightBody
                }}> (#{g.game_number})</span>}</span>
                <PricePill price={g.price_tier} />
              </div>
            </div>
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {tableRows.map((row, ri, arr) => (
        <tr key={row.label}>
          <td style={{
            ...S.metricLabel, padding: "6px 14px",
            borderBottom: ri < arr.length - 1 ? `1px solid ${T.divider}` : "none",
          }}>
            {row.label}
          </td>
          {row.values.map((v, ci) => (
            <td key={ci} style={{
              padding: "6px 14px", textAlign: "center",
              color: T.textPrimary,
              borderBottom: ri < arr.length - 1 ? `1px solid ${T.divider}` : "none",
            }}>
              {v.main === "__bar__" ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 36, height: 5, borderRadius: 3,
                    background: T.border, overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${v.score}%`, height: "100%",
                      borderRadius: 3, background: T.accent,
                    }} />
                  </div>
                  <span style={{ fontWeight: T.weightDisplay }}>
                    {Math.round(v.score!)}
                  </span>
                </div>
              ) : (
                <>
                  {v.main}
                  {v.sub && (
                    <span style={{
                      fontSize: T.sizeCaption, color: T.textTertiary, marginLeft: 4,
                    }}>
                      ({v.sub})
                    </span>
                  )}
                </>
              )}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## 6. Prize Odds Profile — Single Game (Detail Page)

**What it shows:** Same concept as the multi-game version but for one game. Single accent-colored line, no dash patterns, no RangeSlider. Thresholds are filtered to only those <= the game's top prize value.

### Data Inputs

| Field | Source | Description |
|-------|--------|-------------|
| `marginal_odds` | **Computed** by score engine | Same as multi-game version |
| `p_losing` | **Computed** by score engine | "Any" threshold value |
| `top_prize_value` | **Computed** in service | Used to cap the threshold range |

### Data transformation

```ts
const oddsData = useMemo(() => {
  if (!matchedGame) return [];
  const gameThresholds = THRESHOLDS.filter(t => t <= matchedGame.top_prize_value);
  return gameThresholds.map((t) => ({
    threshold: formatThreshold(t),
    odds: t === 0 ? (1 - matchedGame.p_losing) : (matchedGame.marginal_odds[t] ?? 0),
  }));
}, [matchedGame]);
```

### Chart rendering

```tsx
<ResponsiveContainer width="100%" height="100%">
  <LineChart data={oddsData} margin={{ top: 8, right: 12, bottom: 28, left: 20 }}>
    <XAxis
      dataKey="threshold"
      tick={S.chartTick} tickLine={false}
      label={{ value: "Minimum Win Amount", position: "bottom", offset: 10, ...S.chartAxisLabel }}
    />
    <YAxis
      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
      tick={S.chartTick} tickLine={false}
      label={{ value: "Probability", angle: -90, position: "insideLeft", offset: -2, ...S.chartAxisLabel }}
      width={55}
    />
    <Tooltip
      cursor={<CrossCursor />}
      content={({ payload, label }) => {
        if (!payload || payload.length === 0) return null;
        const val = payload[0].value as number;
        return (
          <div style={{ ...S.tooltip }}>
            <div style={{ fontWeight: T.weightLabel, marginBottom: 2 }}>Win {label}</div>
            <div>{(val * 100).toFixed(2)}%</div>
          </div>
        );
      }}
    />
    <Line
      type="monotone" dataKey="odds" stroke={T.accent} strokeWidth={2}
      dot={{ r: 3, fill: T.accent }} activeDot={{ r: 5 }}
    />
  </LineChart>
</ResponsiveContainer>
```

---

## 7. Prize Depletion Bars (Detail Page)

**What it shows:** Three horizontal progress bars (High $500+, Mid $50–$499, Low under $50) showing what percentage of prizes remain in each band. Color-coded by health: green > 75%, yellow 25–75%, red < 25%.

### Data Inputs

| Field | Source | Description |
|-------|--------|-------------|
| `prizes[].prize_value` | `prizes.prize_value` | Used to assign tiers to bands |
| `prizes[].prizes_remaining` | `prizes.prizes_remaining` | Remaining count per tier |
| `prizes[].total_tickets` | `prizes.total_tickets` | Original count per tier |
| `prizes[].is_free_ticket` | `prizes.is_free_ticket` | Free ticket tiers excluded from bands |

### Band computation

```ts
interface Band {
  name: string;
  range: string;
  remaining: number;
  total: number;
  pct: number;
}

function computeBands(prizes: GameDetail["prizes"]): Band[] {
  const nonFree = prizes.filter((p) => !p.is_free_ticket);
  const groups = [
    { name: "High", range: "$500+", filter: (p) => p.prize_value >= 500 },
    { name: "Mid", range: "$50 – $499", filter: (p) => p.prize_value >= 50 && p.prize_value < 500 },
    { name: "Low", range: "Under $50", filter: (p) => p.prize_value < 50 },
  ];

  return groups
    .map(({ name, range, filter }) => {
      const tiers = nonFree.filter(filter);
      if (tiers.length === 0) return null;
      const remaining = tiers.reduce((s, p) => s + p.prizes_remaining, 0);
      const total = tiers.reduce((s, p) => s + p.total_tickets, 0);
      return { name, range, remaining, total,
        pct: total > 0 ? Math.round((remaining / total) * 100) : 0 };
    })
    .filter((b): b is Band => b !== null);
}

function depletionColor(pct: number): string {
  if (pct > 75) return "#18C284";   // OUTCOME_COLORS.win
  if (pct >= 25) return "#FFE787";  // OUTCOME_COLORS.even
  return "#FF787B";                  // OUTCOME_COLORS.lose
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
```

### Rendering

```tsx
<div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 16 }}>
  {bands.map((band) => (
    <div key={band.name}>
      <div style={{
        display: "flex", alignItems: "baseline",
        justifyContent: "space-between", marginBottom: 6,
      }}>
        <div>
          <span style={{ fontSize: T.sizeSmall, fontWeight: T.weightLabel, color: T.textPrimary }}>
            {band.name}
          </span>
          <span style={{ fontSize: T.sizeCaption, color: T.textSecondary, marginLeft: 6 }}>
            {band.range}
          </span>
        </div>
        <span style={{ fontSize: T.sizeSmall, fontWeight: T.weightLabel, color: T.textPrimary }}>
          {band.pct}%
        </span>
      </div>
      <div style={{ height: 10, background: T.divider, borderRadius: 5, overflow: "hidden" }}>
        <div style={{
          width: `${band.pct}%`, height: "100%",
          background: depletionColor(band.pct), borderRadius: 5,
        }} />
      </div>
      <div style={{ fontSize: T.sizeCaption, color: T.textTertiary, marginTop: 4 }}>
        {formatCount(band.remaining)} remaining
      </div>
    </div>
  ))}
</div>
```

---

## 8. Recent Big Wins Table (Detail Page)

**What it shows:** Table of recently claimed prizes >= $10,000 for the current game, detected by comparing consecutive scrape dates.

### Data Inputs

| Field | Source | Description |
|-------|--------|-------------|
| `detected_date` | **Computed** in `02-data-api/queries.ts`. The `scrape_date` when the claim was detected (latest scrape date in `prizes` table). | Date shown in first column |
| `game_name` | `games.game_name` | Used to filter claims to current game |
| `prize_value` | `prizes.prize_value` | Dollar amount. Only prizes >= $10,000 included (via SQL `WHERE p_new.prize_value >= 10000`) |
| `prize_label` | `prizes.prize_label` | Not displayed in this table but available |
| `claimed_count` | **Computed** in SQL: `p_old.prizes_remaining - p_new.prizes_remaining` between consecutive scrape dates | Number of prizes claimed in that period |
| `price_tier` | `games.price_tier` | Available but not displayed |

### Data transformation

```ts
const bigWins = useMemo(() => {
  if (!matchedGame || !apiData?.recently_claimed) return [];
  return apiData.recently_claimed
    .filter((c) => c.game_name === matchedGame.game_name)
    .map((c) => ({
      prize: `$${c.prize_value.toLocaleString()}`,
      date: new Date(c.detected_date).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      }),
      count: c.claimed_count,
    }));
}, [matchedGame, apiData]);
```

### Rendering

```tsx
<table style={{
  width: "100%", borderCollapse: "collapse",
  fontSize: T.sizeBody, fontFamily: T.font,
}}>
  <thead>
    <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
      <th style={{ ...S.metricLabel, textTransform: "uppercase", textAlign: "left", padding: "0 0 8px", fontWeight: T.weightLabel }}>Date</th>
      <th style={{ ...S.metricLabel, textTransform: "uppercase", textAlign: "left", padding: "0 0 8px", fontWeight: T.weightLabel }}>Prize</th>
      <th style={{ ...S.metricLabel, textTransform: "uppercase", textAlign: "right", padding: "0 0 8px", fontWeight: T.weightLabel }}>Claimed</th>
    </tr>
  </thead>
  <tbody>
    {bigWins.map((win, i) => (
      <tr key={i} style={{ borderBottom: i < bigWins.length - 1 ? `1px solid ${T.divider}` : "none" }}>
        <td style={{ padding: "10px 0", color: T.textSecondary, fontSize: T.sizeSmall }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {/* Calendar icon SVG */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {win.date}
          </span>
        </td>
        <td style={{ padding: "10px 0", color: T.textPrimary, fontWeight: T.weightLabel }}>
          {win.prize}
        </td>
        <td style={{ padding: "10px 0", color: T.textSecondary, textAlign: "right" }}>
          {win.count}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## Database Schema Reference

All visualization data ultimately derives from two tables:

### `games` table

```sql
SELECT game_id, game_number, game_name, state, price_tier, overall_odds,
       tickets_printed, is_active, game_url, image_url
FROM games
WHERE is_active = true AND state = $1
```

| Column | Type | Used by |
|--------|------|---------|
| `game_id` | int | All — unique identifier |
| `game_number` | text | Display names, tooltips |
| `game_name` | text | Display names, tooltips, big wins filtering |
| `price_tier` | int | Color mapping (`PRICE_COLORS`), PricePill, avg_cash_prize calc |
| `overall_odds` | text | Used by score engine for losing ticket estimation |
| `tickets_printed` | int | Used by score engine |
| `image_url` | text | Game detail header (not in charts) |

### `prizes` table

```sql
SELECT prize_id, game_id, prize_label, prize_value, total_tickets,
       prizes_remaining, prize_odds, is_free_ticket, scrape_date
FROM prizes
WHERE game_id = ANY($1) AND scrape_date = $2
```

| Column | Type | Used by |
|--------|------|---------|
| `prize_value` | numeric | Marginal odds thresholds, top prize, band grouping, avg cash prize |
| `prizes_remaining` | numeric | All probability calcs, depletion bands, top prize remaining, big wins detection |
| `total_tickets` | int | Depletion band percentages |
| `is_free_ticket` | bool | Excluded from cash prize calcs and depletion bands |
| `prize_label` | text | Prize depletion detail display |
| `scrape_date` | date | Temporal filtering, big wins detection (diff between consecutive dates) |

### Computed fields (score engine)

These are derived at runtime, not stored in the database:

| Field | Derivation |
|-------|-----------|
| `p_losing` | Estimated from `overall_odds` or computed from prize/ticket ratios |
| `p_breaking_even` | Sum of probabilities for tiers where `prize_value == price_tier` |
| `p_winning_cash` | Sum of probabilities for tiers where `prize_value > price_tier` and `!is_free_ticket` |
| `p_free_ticket` | Sum of probabilities for tiers where `is_free_ticket == true` |
| `marginal_odds` | For each threshold T in `[10, 50, 100, 500, 1K, 5K, 10K, 50K, 100K]`: P(winning >= $T) = sum of (prizes_remaining / total_remaining_tickets) for tiers with prize_value >= T |
| `reward_raw` | Weighted expected prize value above ticket cost |
| `risk_raw` | Expected loss per ticket |
| `reward_scaled` | Min-max scaled `reward_raw` across all games in state (0–10) |
| `risk_scaled` | Min-max scaled `risk_raw` across all games in state (0–10) |
| `value_score` | Composite 0–100 score combining reward, risk, and probability factors |
| `avg_cash_prize` | Weighted avg of `prize_value` for cash-winning tiers, weighted by `prizes_remaining` |
| `top_prize_value` | Max `prize_value` where `prizes_remaining > 0` |
| `top_prize_remaining` | Sum of `prizes_remaining` for the top prize tier |
| `avg_return_per_ticket` | `(sum(prize_value * prizes_remaining) / total_remaining_tickets) - price_tier` |

---

## TypeScript Interfaces

```ts
export interface Game {
  game_id: number;
  game_name: string;
  game_number: string;
  price_tier: number;
  top_prize_value: number;
  value_score: number;
  reward_raw: number;
  risk_raw: number;
  reward_scaled: number;
  risk_scaled: number;
  image_url: string | null;
  p_losing: number;
  p_breaking_even: number;
  p_winning_cash: number;
  p_free_ticket: number;
  big_prizes_remaining: number;
  avg_cash_prize: number;
  top_prize_remaining: number;
  avg_return_per_ticket: number;
  big_prizes_total: number;
  marginal_odds: Record<number, number>;
}

export interface GameDetail extends Game {
  prizes: Array<{
    prize_label: string;
    prize_value: number;
    total_tickets: number;
    prizes_remaining: number;
    is_free_ticket: boolean;
  }>;
}
```
