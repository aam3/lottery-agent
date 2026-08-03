"use client";

import { T } from "@/lib/tokens";

export default function DashboardEmpty() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 8,
        fontFamily: T.font,
      }}
    >
      <div
        style={{
          fontSize: T.sizeBody,
          color: T.textSecondary,
          fontWeight: T.weightBody,
        }}
      >
        Explore a game to see detailed stats here
      </div>
      <div
        style={{
          fontSize: T.sizeCaption,
          color: T.textTertiary,
        }}
      >
        Click &ldquo;Explore&rdquo; on any recommendation
      </div>
    </div>
  );
}
