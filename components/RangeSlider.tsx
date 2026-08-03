"use client";

import { useRef, useCallback } from "react";
import { T } from "@/lib/tokens";

interface RangeSliderProps {
  min: number;
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  width?: number;
}

export default function RangeSlider({ min, max, low, high, onChange, width = 220 }: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeThumb = useRef<"low" | "high" | null>(null);

  const pctOf = (v: number) => ((v - min) / (max - min)) * 100;

  const valFromX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(pct * (max - min) + min);
    },
    [min, max],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const val = valFromX(e.clientX);
      // Capture whichever thumb is closer
      const distLow = Math.abs(val - low);
      const distHigh = Math.abs(val - high);
      activeThumb.current = distLow <= distHigh ? "low" : "high";
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [valFromX, low, high],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeThumb.current) return;
      const val = valFromX(e.clientX);
      if (activeThumb.current === "low") {
        onChange(Math.min(val, high - 1), high);
      } else {
        onChange(low, Math.max(val, low + 1));
      }
    },
    [valFromX, low, high, onChange],
  );

  const onPointerUp = useCallback(() => {
    activeThumb.current = null;
  }, []);

  const thumbStyle = {
    position: "absolute" as const,
    top: "50%",
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: T.accent,
    border: "2px solid #fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    transform: "translate(-50%, -50%)",
    zIndex: 2,
  };

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative",
        width,
        height: 20,
        touchAction: "none",
        cursor: "pointer",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Background track */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 4,
          borderRadius: 2,
          background: "#e0dcd4",
        }}
      />
      {/* Filled track */}
      <div
        style={{
          position: "absolute",
          left: `${pctOf(low)}%`,
          width: `${pctOf(high) - pctOf(low)}%`,
          top: "50%",
          transform: "translateY(-50%)",
          height: 4,
          borderRadius: 2,
          background: T.accent,
        }}
      />
      {/* Low thumb */}
      <div style={{ ...thumbStyle, left: `${pctOf(low)}%` }} />
      {/* High thumb */}
      <div style={{ ...thumbStyle, left: `${pctOf(high)}%` }} />
    </div>
  );
}
