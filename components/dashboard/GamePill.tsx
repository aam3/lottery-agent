"use client";

import { T } from "@/lib/tokens";

interface GamePillProps {
  gameName: string;
  gameNumber: string;
  priceColor?: string;
  onRemove: () => void;
}

export default function GamePill({ gameName, gameNumber, priceColor, onRemove }: GamePillProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(255,255,255,0.6)",
        border: `1px solid ${T.border}`,
        borderRadius: T.chipRadius,
        padding: "4px 8px 4px 10px",
        fontSize: T.sizeSmall,
        fontWeight: T.weightLabel,
        color: T.textPrimary,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
        overflow: "hidden",
        fontFamily: T.font,
      }}
    >
      {priceColor && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: priceColor,
            flexShrink: 0,
          }}
        />
      )}
      <span>
        {gameName}
        <span style={{ fontSize: T.sizeCaption, fontWeight: T.weightBody, color: T.textTertiary, marginLeft: 3 }}>
          (#{gameNumber})
        </span>
      </span>
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: T.textTertiary,
          fontSize: 11,
          lineHeight: 1,
          padding: 0,
          display: "flex",
          alignItems: "center",
        }}
        aria-label={`Remove ${gameName}`}
      >
        ✕
      </button>
    </div>
  );
}
