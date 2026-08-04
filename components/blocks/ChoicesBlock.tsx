"use client";

import type { ChoicesBlock as ChoicesBlockType } from "./types";
import { T } from "@/lib/tokens";
import PromptButton from "@/components/PromptButton";

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
          fontSize: T.sizeBody,
          fontWeight: T.weightTitle,
          color: T.textPrimary,
          lineHeight: T.lhBody,
          marginBottom: 12,
        }}
      >
        {block.prompt}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {block.options.map((option) => (
          <PromptButton
            key={option}
            text={option}
            onClick={() => onSelect?.(option, block.prompt)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
