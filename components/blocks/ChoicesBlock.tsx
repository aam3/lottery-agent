"use client";

import type { ChoicesBlock as ChoicesBlockType } from "./types";
import { T } from "@/lib/tokens";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

interface Props {
  block: ChoicesBlockType;
  onSelect?: (choice: string, prompt: string) => void;
  disabled?: boolean;
}

export default function ChoicesBlock({ block, onSelect, disabled }: Props) {
  return (
    <div>
      <p
        style={{
          fontSize: T.sizeTitle,
          fontWeight: T.weightTitle,
          color: T.textPrimary,
          lineHeight: T.lhTitle,
          marginBottom: 12,
        }}
      >
        {block.prompt}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {block.options.map((option, i) => (
          <button
            key={option}
            onClick={() => onSelect?.(option, block.prompt)}
            disabled={disabled}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              fontSize: T.sizeBody,
              fontWeight: T.weightBody,
              color: disabled ? T.textTertiary : T.textPrimary,
              background: disabled ? T.badgeBg : T.cardBg,
              border: `1px solid ${disabled ? T.badgeBorder : T.border}`,
              borderRadius: T.smallRadius,
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.6 : 1,
              transition: "background 0.15s, border-color 0.15s",
              textAlign: "left" as const,
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                const btn = e.currentTarget;
                btn.style.background = T.pickBg;
                btn.style.borderColor = T.accent;
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                const btn = e.currentTarget;
                btn.style.background = T.cardBg;
                btn.style.borderColor = T.border;
              }
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: disabled ? T.badgeBg : T.accent,
                color: disabled ? T.textTertiary : "#fff",
                fontSize: T.sizeSmall,
                fontWeight: T.weightLabel,
                flexShrink: 0,
              }}
            >
              {LETTERS[i]}
            </span>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
