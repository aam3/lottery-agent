"use client";

import type { ExploreOptionsBlock } from "./types";
import PromptButton from "@/components/PromptButton";

interface Props {
  block: ExploreOptionsBlock;
  onSelect?: (option: string) => void;
  disabled?: boolean;
}

export default function ExploreOptions({ block, onSelect, disabled }: Props) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {block.options.map((option) => (
        <PromptButton
          key={option}
          text={option}
          onClick={() => onSelect?.(option)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
