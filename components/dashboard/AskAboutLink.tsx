"use client";

import { T } from "@/lib/tokens";

interface AskAboutLinkProps {
  visual: string;
  onAsk: (visual: string) => void;
}

export default function AskAboutLink({ visual, onAsk }: AskAboutLinkProps) {
  return (
    <button
      onClick={() => onAsk(visual)}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: T.accent,
        fontSize: T.sizeSmall,
        fontWeight: T.weightBody,
        fontFamily: T.font,
        padding: 0,
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLButtonElement).style.textDecoration = "underline";
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLButtonElement).style.textDecoration = "none";
      }}
    >
      Ask about this &rarr;
    </button>
  );
}
