"use client";

import { T, S } from "@/lib/tokens";
import type { RecentBigWinsBlock } from "./types";

export default function RecentBigWins({ block }: { block: RecentBigWinsBlock }) {
  if (block.wins.length === 0) {
    return (
      <div style={{ ...S.card, padding: 20 }}>
        <div style={{ ...S.sectionTitle, fontFamily: T.font, marginBottom: 8 }}>
          Recent Big Wins
        </div>
        <p style={{ fontSize: T.sizeSmall, color: T.textSecondary, fontFamily: T.font }}>
          No prizes of $10,000+ claimed recently for this game.
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, padding: 20 }}>
      <div style={{ ...S.sectionTitle, fontFamily: T.font, marginBottom: 16 }}>
        Recent Big Wins
        <span style={{ fontSize: T.sizeSmall, fontWeight: T.weightBody, color: T.textSecondary, marginLeft: 8 }}>
          — Prizes $10K+ claimed
        </span>
      </div>
      <table style={{
        width: "100%", borderCollapse: "collapse",
        fontSize: T.sizeBody, fontFamily: T.font,
      }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
            <th style={{ ...S.metricLabel, textTransform: "uppercase" as const, textAlign: "left" as const, padding: "0 0 8px", fontWeight: T.weightLabel, fontFamily: T.font }}>
              Date
            </th>
            <th style={{ ...S.metricLabel, textTransform: "uppercase" as const, textAlign: "left" as const, padding: "0 0 8px", fontWeight: T.weightLabel, fontFamily: T.font }}>
              Prize
            </th>
            <th style={{ ...S.metricLabel, textTransform: "uppercase" as const, textAlign: "right" as const, padding: "0 0 8px", fontWeight: T.weightLabel, fontFamily: T.font }}>
              Claimed
            </th>
          </tr>
        </thead>
        <tbody>
          {block.wins.map((win, i) => (
            <tr key={i} style={{ borderBottom: i < block.wins.length - 1 ? `1px solid ${T.divider}` : "none" }}>
              <td style={{ padding: "10px 0", color: T.textSecondary, fontSize: T.sizeSmall, fontFamily: T.font }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {win.date}
                </span>
              </td>
              <td style={{ padding: "10px 0", color: T.textPrimary, fontWeight: T.weightLabel, fontFamily: T.font }}>
                {win.prize}
              </td>
              <td style={{ padding: "10px 0", color: T.textSecondary, textAlign: "right" as const, fontFamily: T.font }}>
                {win.claimed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
