"use client";

import { useMemo } from "react";
import { T, S, buildPriceColors } from "@/lib/tokens";
import { PricePill } from "@/lib/chartUtils";
import type { ComparisonTableBlock } from "./types";

export default function ComparisonTable({ block }: { block: ComparisonTableBlock }) {
  const { games, rows } = block;

  const priceColors = useMemo(
    () => buildPriceColors([...new Set(games.map((g) => g.price_tier))]),
    [games],
  );

  return (
    <div style={{ ...S.card, overflow: "hidden" }}>
      <table style={{
        width: "100%", borderCollapse: "collapse",
        fontFamily: T.font, fontSize: T.sizeSmall,
      }}>
        <thead>
          <tr>
            <th style={{
              textAlign: "left", padding: "10px 14px",
              borderBottom: `1px solid ${T.divider}`, width: 120,
            }} />
            {games.map((g, i) => (
              <th key={i} style={{
                textAlign: "center", padding: "10px 14px",
                borderBottom: `1px solid ${T.divider}`, fontWeight: T.weightTitle,
              }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{g.game_name}{g.game_number && <span style={{
                      fontSize: T.sizeCaption, color: T.textTertiary, fontWeight: T.weightBody
                    }}> (#{g.game_number})</span>}</span>
                    <PricePill price={g.price_tier} color={priceColors[g.price_tier]} />
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.label}>
              <td style={{
                ...S.metricLabel, padding: "8px 14px",
                borderBottom: ri < rows.length - 1 ? `1px solid ${T.divider}` : "none",
                textTransform: "uppercase",
                fontFamily: T.font,
              }}>
                {row.label}
              </td>
              {row.values.map((v, ci) => (
                <td key={ci} style={{
                  padding: "8px 14px", textAlign: "center",
                  color: T.textPrimary,
                  borderBottom: ri < rows.length - 1 ? `1px solid ${T.divider}` : "none",
                  fontFamily: T.font,
                }}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
