"use client";

import { T } from "@/lib/tokens";
import type { FreshnessBlock as FreshnessBlockType } from "./types";

export default function FreshnessBlock({ block }: { block: FreshnessBlockType }) {
  const date = new Date(block.timestamp);
  const formatted = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 12,
        borderTop: `1px solid ${T.divider}`,
        color: T.textTertiary,
        fontSize: T.sizeSmall,
        fontFamily: T.font,
        fontStyle: "italic",
      }}
    >
      Data last updated {formatted}.
    </div>
  );
}
