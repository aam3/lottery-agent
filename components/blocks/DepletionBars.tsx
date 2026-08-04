"use client";

import { T, S } from "@/lib/tokens";
import { depletionColor } from "@/lib/chartUtils";
import type { DepletionBarsBlock } from "./types";

export default function DepletionBars({ block }: { block: DepletionBarsBlock }) {
  return (
    <div style={{ ...S.card, padding: 20 }}>
      <div style={{ ...S.sectionTitle, fontFamily: T.font, marginBottom: 16 }}>
        {block.game_name}
        <span style={{ fontSize: T.sizeSmall, fontWeight: T.weightBody, color: T.textTertiary, marginLeft: 4 }}>
          (#{block.game_number})
        </span>
        <span style={{ fontSize: T.sizeSmall, fontWeight: T.weightBody, color: T.textSecondary, marginLeft: 8 }}>
          — Prize Pool Health
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {block.bands.map((band) => (
          <div key={band.name}>
            <div style={{
              display: "flex", alignItems: "baseline",
              justifyContent: "space-between", marginBottom: 6,
            }}>
              <div>
                <span style={{ fontSize: T.sizeSmall, fontWeight: T.weightLabel, color: T.textPrimary, fontFamily: T.font }}>
                  {band.name}
                </span>
                <span style={{ fontSize: T.sizeCaption, color: T.textSecondary, marginLeft: 6, fontFamily: T.font }}>
                  {band.range}
                </span>
              </div>
              <span style={{ fontSize: T.sizeSmall, fontWeight: T.weightLabel, color: T.textPrimary, fontFamily: T.font }}>
                {band.pct}%
              </span>
            </div>
            <div style={{ height: 10, background: T.divider, borderRadius: 5, overflow: "hidden" }}>
              <div style={{
                width: `${band.pct}%`, height: "100%",
                background: depletionColor(band.pct), borderRadius: 5,
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
