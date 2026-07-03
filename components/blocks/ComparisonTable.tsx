"use client";

import { useMemo } from "react";
import { T, S, buildPriceColors } from "@/lib/tokens";
import { PricePill } from "@/lib/chartUtils";
import type { ComparisonTableBlock } from "./types";

export default function ComparisonTable({ block }: { block: ComparisonTableBlock }) {
  const { columns, rows } = block;

  const priceColors = useMemo(() => {
    const tiers = rows.map((r) => r.price_tier).filter((t): t is number => t != null);
    return tiers.length > 0 ? buildPriceColors([...new Set(tiers)]) : {};
  }, [rows]);

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
              borderBottom: `1px solid ${T.divider}`, width: 180,
            }} />
            {columns.map((col, i) => (
              <th key={i} style={{
                ...S.metricLabel,
                textAlign: "center", padding: "10px 14px",
                borderBottom: `1px solid ${T.divider}`,
                textTransform: "uppercase",
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              <td style={{
                padding: "8px 14px",
                borderBottom: ri < rows.length - 1 ? `1px solid ${T.divider}` : "none",
                fontWeight: T.weightTitle,
                color: T.textPrimary,
                fontFamily: T.font,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{row.label}</span>
                  {row.price_tier != null && (
                    <PricePill price={row.price_tier} color={priceColors[row.price_tier]} />
                  )}
                </div>
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
