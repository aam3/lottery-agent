"use client";

import type { ExploreOptionsBlock } from "./types";
import { T } from "@/lib/tokens";

interface Props {
  block: ExploreOptionsBlock;
  onSelect?: (option: string) => void;
  disabled?: boolean;
}

export default function ExploreOptions({ block, onSelect, disabled }: Props) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {block.options.map((option) => (
        <button
          key={option}
          onClick={() => onSelect?.(option)}
          disabled={disabled}
          style={{
            padding: "8px 18px",
            fontSize: T.sizeSmall,
            fontWeight: T.weightLabel,
            fontFamily: T.font,
            color: disabled ? T.textTertiary : T.accent,
            background: disabled ? T.badgeBg : "transparent",
            border: `1px solid ${disabled ? T.badgeBorder : T.accent}`,
            borderRadius: 8,
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.5 : 1,
            transition: "background 0.15s, color 0.15s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              const btn = e.currentTarget;
              btn.style.background = T.accent;
              btn.style.color = "#fff";
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              const btn = e.currentTarget;
              btn.style.background = "transparent";
              btn.style.color = T.accent;
            }
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
