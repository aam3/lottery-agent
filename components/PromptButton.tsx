"use client";

import { T } from "@/lib/tokens";

interface PromptButtonProps {
  text: string;
  onClick?: () => void;
  disabled?: boolean;
}

export default function PromptButton({ text, onClick, disabled }: PromptButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 16px",
        background: disabled ? T.badgeBg : "transparent",
        border: `1.5px solid ${disabled ? T.badgeBorder : T.accent}`,
        borderRadius: T.cardRadius,
        cursor: disabled ? "default" : "pointer",
        fontSize: T.sizeSmall,
        fontWeight: T.weightLabel,
        fontFamily: T.font,
        color: disabled ? T.textTertiary : T.accent,
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.15s, color 0.15s",
        textAlign: "left" as const,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = T.accent;
          e.currentTarget.style.color = "#fff";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = T.accent;
        }
      }}
    >
      {text}
    </button>
  );
}
