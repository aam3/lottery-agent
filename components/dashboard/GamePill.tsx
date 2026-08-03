"use client";

import { T } from "@/lib/tokens";

interface GamePillProps {
  gameName: string;
  gameNumber: string;
  onRemove: () => void;
}

export default function GamePill({ gameName, gameNumber, onRemove }: GamePillProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: T.pillRadius,
        border: `1px solid ${T.border}`,
        background: T.cardBg,
        fontSize: T.sizeSmall,
        fontWeight: T.weightLabel,
        color: T.textPrimary,
        fontFamily: T.font,
      }}
    >
      <span>{gameName} (#{gameNumber})</span>
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: T.textTertiary,
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
          display: "flex",
          alignItems: "center",
        }}
        aria-label={`Remove ${gameName}`}
      >
        ×
      </button>
    </div>
  );
}
