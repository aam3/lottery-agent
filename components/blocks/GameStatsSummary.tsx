"use client";

import { T, S } from "@/lib/tokens";
import type { GameStatsSummaryBlock } from "./types";

export default function GameStatsSummary({ block }: { block: GameStatsSummaryBlock }) {
  return (
    <div style={{
      padding: "16px 28px",
      borderTop: `1px solid ${T.divider}`,
      borderBottom: `1px solid ${T.divider}`,
      display: "flex",
      alignItems: "stretch",
      gap: 24,
      fontFamily: T.font,
    }}>
      {/* Image — spans full height of name + metrics */}
      {block.image_url ? (
        <img
          src={block.image_url}
          alt={block.game_name}
          style={{
            width: 72,
            borderRadius: T.smallRadius,
            objectFit: "cover",
            flexShrink: 0,
            alignSelf: "stretch",
          }}
        />
      ) : (
        <div style={{
          width: 72,
          borderRadius: T.smallRadius,
          background: T.pickBg,
          border: `1px dashed ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: T.sizeCaption,
          color: T.textTertiary,
        }}>
          IMG
        </div>
      )}
      {/* Right side: game name on top, metrics below */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 8 }}>
        {/* Game name */}
        <div style={{
          fontSize: T.sizeTitle,
          fontWeight: T.weightTitle,
          color: T.textPrimary,
        }}>
          {block.game_name}
          <span style={{
            fontSize: T.sizeBody,
            fontWeight: T.weightBody,
            color: T.textTertiary,
            marginLeft: 4,
          }}>
            (#{block.game_number})
          </span>
        </div>
        {/* Metrics row */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {[...block.metrics].sort((a, b) => {
            const aRank = /rank/i.test(a.label) ? 0 : 1;
            const bRank = /rank/i.test(b.label) ? 0 : 1;
            return aRank - bRank;
          }).map((m) => {
            const isRank = /rank/i.test(m.label);
            return (
              <div key={m.label}>
                <div style={{ ...S.metricLabel, textTransform: "uppercase", lineHeight: T.lhLabel }}>
                  {m.label}
                </div>
                <div style={{
                  fontSize: T.sizeBody,
                  fontWeight: isRank ? T.weightLabel : T.weightBody,
                  color: isRank ? T.accent : T.textPrimary,
                  marginTop: 2,
                }}>
                  {m.value}
                  {m.suffix && (
                    <span style={{
                      fontSize: T.sizeCaption,
                      color: T.textSecondary,
                      marginLeft: 3,
                    }}>
                      {m.suffix}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
