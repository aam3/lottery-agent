"use client";

import { useMemo } from "react";
import { T, S, buildPriceColors } from "@/lib/tokens";
import { PricePill } from "@/lib/chartUtils";
import type { ComparisonTableBlock } from "./types";

function GamePart({ text, priceColors }: { text: string; priceColors: Record<number, string> }) {
  // Parse "1× Gold Rush (#1501) ($5)" or "9× 20X ($5)" — extract trailing ($N)
  const priceMatch = text.match(/\s*\(\$(\d+)\)\s*$/);
  const withoutPrice = priceMatch ? text.slice(0, priceMatch.index) : text;
  // Highlight quantity number (e.g. "9×") in accent color
  const qtyMatch = withoutPrice.match(/^(\d+×)/);
  const afterQty = qtyMatch ? withoutPrice.slice(qtyMatch[0].length) : withoutPrice;
  // Parse game number "(#XXXXX)" from the remaining text
  const numMatch = afterQty.match(/\s*\(#(\d+)\)/);
  const gameName = numMatch ? afterQty.slice(0, numMatch.index) : afterQty;
  const gameNum = numMatch ? numMatch[0] : null;

  const label = (
    <>
      {qtyMatch && <span style={{ color: T.accent, fontWeight: T.weightDisplay, marginRight: 4 }}>{qtyMatch[1]}</span>}
      {gameName}
      {gameNum && <span style={{ fontSize: T.sizeCaption, fontWeight: T.weightBody, color: T.textTertiary, marginLeft: 3 }}>{gameNum}</span>}
    </>
  );

  if (!priceMatch) return <>{label}</>;
  const price = parseInt(priceMatch[1]);
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {label}<span style={{ marginLeft: 5, marginRight: 3 }}><PricePill price={price} color={priceColors[price]} /></span>
    </span>
  );
}

function StrategyLabel({ label, priceColors }: { label: string; priceColors: Record<number, string> }) {
  if (!label.includes(" + ")) return <GamePart text={label} priceColors={priceColors} />;
  const parts = label.split(" + ");
  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          <GamePart text={part} priceColors={priceColors} />
          {i < parts.length - 1 && (
            <>
              <span style={{ color: T.textTertiary, marginLeft: 6 }}>+</span>
              <br />
            </>
          )}
        </span>
      ))}
    </span>
  );
}

interface Props {
  block: ComparisonTableBlock;
  onCompare?: (gameIds: number[]) => void;
  disabled?: boolean;
  dashboardGameIds?: Set<number>;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export default function ComparisonTable({ block, onCompare, dashboardGameIds, header, footer }: Props) {
  // Map each row to a game_id if available (game_ids array corresponds to rows in order)
  const rowGameIds = block.game_ids && block.game_ids.length === block.rows.length
    ? block.game_ids
    : null;
  const { columns, rows } = block;

  // Auto-detect if agent included the row label as the first column
  // (more columns than values in the first row). Cap at 3 metric columns
  // when Explore links are present (chat context) to reserve space for them.
  const hasExploreLinks = !!rowGameIds && !!onCompare;
  const effectiveColumns = useMemo(() => {
    let cols = columns;
    if (rows.length > 0 && cols.length > rows[0].values.length) {
      cols = cols.slice(cols.length - rows[0].values.length);
    }
    return hasExploreLinks ? cols.slice(0, 3) : cols;
  }, [columns, rows, hasExploreLinks]);

  const priceColors = useMemo(() => {
    const tiers = new Set<number>();
    for (const r of rows) {
      if (r.price_tier != null) tiers.add(r.price_tier);
      // Also extract prices from label text like "($5)"
      const matches = r.label.matchAll(/\(\$(\d+)\)/g);
      for (const m of matches) tiers.add(parseInt(m[1]));
    }
    return tiers.size > 0 ? buildPriceColors([...tiers]) : {};
  }, [rows]);

  return (
    <div style={{ ...S.card, overflowX: "auto", padding: header ? 16 : 0 }}>
      {header}
      <table style={{
        width: "100%", borderCollapse: "collapse",
        fontFamily: T.font, fontSize: T.sizeSmall,
      }}>
        <thead>
          <tr>
            <th style={{
              textAlign: "left", padding: "10px 14px",
              borderBottom: `1px solid ${T.divider}`,
            }} />
            {effectiveColumns.map((col, i) => (
              <th key={i} style={{
                ...S.metricLabel,
                textAlign: "center", padding: "10px 14px",
                borderBottom: `1px solid ${T.divider}`,
                textTransform: "uppercase",
              }}>
                {col.label}
              </th>
            ))}
            {rowGameIds && onCompare && (
              <th style={{
                padding: "10px 14px",
                borderBottom: `1px solid ${T.divider}`,
                width: 1,
              }} />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const gameId = rowGameIds ? rowGameIds[ri] : undefined;
            const isOnDashboard = gameId != null && dashboardGameIds?.has(gameId);

            return (
              <tr key={ri}>
                <td style={{
                  padding: "8px 14px",
                  borderBottom: ri < rows.length - 1 ? `1px solid ${T.divider}` : "none",
                  fontWeight: T.weightTitle,
                  color: T.textPrimary,
                  fontFamily: T.font,
                  whiteSpace: row.label.includes(" + ") ? "normal" : "nowrap",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <StrategyLabel label={row.label} priceColors={priceColors} />
                    {row.price_tier != null && !/\(\$\d+\)/.test(row.label) && (
                      <PricePill price={row.price_tier} color={priceColors[row.price_tier]} />
                    )}
                  </div>
                </td>
                {row.values.slice(0, effectiveColumns.length).map((v, ci) => (
                  <td key={ci} style={{
                    padding: "8px 14px", textAlign: "center",
                    color: T.textPrimary,
                    borderBottom: ri < rows.length - 1 ? `1px solid ${T.divider}` : "none",
                    fontFamily: T.font,
                  }}>
                    {v}
                  </td>
                ))}
                {rowGameIds && onCompare && (
                  <td style={{
                    padding: "8px 14px",
                    borderBottom: ri < rows.length - 1 ? `1px solid ${T.divider}` : "none",
                    whiteSpace: "nowrap",
                  }}>
                    {gameId != null && (
                      isOnDashboard ? (
                        <span style={{
                          fontSize: T.sizeSmall,
                          fontWeight: T.weightLabel,
                          color: T.accent,
                          fontFamily: T.font,
                        }}>
                          ✓ Exploring
                        </span>
                      ) : (
                        <button
                          onClick={() => onCompare([gameId])}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            fontSize: T.sizeSmall,
                            fontWeight: T.weightLabel,
                            fontFamily: T.font,
                            color: T.accent,
                            cursor: "pointer",
                            textDecoration: "none",
                            textUnderlineOffset: 2,
                            transition: "color 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = "underline";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = "none";
                          }}
                        >
                          + Explore
                        </button>
                      )
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
