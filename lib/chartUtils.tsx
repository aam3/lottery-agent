import type { ReactNode } from "react";
import { T, S } from "./tokens";

// Format functions

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

// Shared chart components

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

// Shared sub-components

export function PricePill({ price, color }: { price: number; color?: string }) {
  return (
    <span style={{
      fontSize: T.sizeCaption,
      fontWeight: T.weightCategory,
      color: "#fff",
      background: color ?? "#999",
      borderRadius: T.pillRadius,
      padding: "1px 7px",
      lineHeight: 1.4,
      flexShrink: 0,
    }}>
      ${price}
    </span>
  );
}

export function LineSwatch({ color, dashArray }: { color: string; dashArray: string }) {
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

// Odds chart constants

export const THRESHOLDS = [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];
export const DASH_PATTERNS = ["0", "8 4", "2 4", "8 4 2 4"];

export function formatThreshold(v: number) {
  if (v === 0) return "Any";
  if (v >= 100000) return "$100K+";
  if (v >= 50000) return "$50K+";
  if (v >= 10000) return "$10K+";
  if (v >= 5000) return "$5K+";
  if (v >= 1000) return "$1K+";
  return `$${v}+`;
}

// Depletion bar utilities

export function depletionColor(pct: number): string {
  if (pct > 75) return "#18C284";   // OUTCOME_COLORS.win
  if (pct >= 25) return "#FFE787";  // OUTCOME_COLORS.even
  return "#FF787B";                  // OUTCOME_COLORS.lose
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
