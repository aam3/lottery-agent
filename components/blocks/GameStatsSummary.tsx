"use client";

import { T, S } from "@/lib/tokens";

const cardBorder = {
  border: `1px solid ${T.border}`,
  borderRadius: T.cardRadius,
};
import type { GameStatsSummaryBlock } from "./types";

interface Props {
  block: GameStatsSummaryBlock;
  onExplore?: (gameName: string, gameNumber: string) => void;
  disabled?: boolean;
}

export default function GameStatsSummary({ block, onExplore, disabled }: Props) {
  return (
    <div style={{
      padding: "16px 28px",
      ...cardBorder,
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
        {/* Game name + explore link */}
        <div style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}>
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
          {block.explorable && onExplore && !disabled && (
            <button
              onClick={() => onExplore(block.game_name, block.game_number)}
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
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              Explore →
            </button>
          )}
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
