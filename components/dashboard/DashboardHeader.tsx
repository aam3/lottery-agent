"use client";

import { T, buildPriceColors } from "@/lib/tokens";
import { useMemo } from "react";
import GamePill from "./GamePill";

export interface DashboardGameInfo {
  gameId: number;
  gameName: string;
  gameNumber: string;
  priceTier: number;
  imageUrl: string | null;
}

interface DashboardHeaderProps {
  games: DashboardGameInfo[];
  onRemoveGame: (gameId: number) => void;
}

export default function DashboardHeader({ games, onRemoveGame }: DashboardHeaderProps) {
  const isEmpty = games.length === 0;

  const priceColors = useMemo(
    () => buildPriceColors([...new Set(games.map((g) => g.priceTier))]),
    [games],
  );

  return (
    <div
      style={{
        height: 48,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 12,
        border: isEmpty
          ? "1.5px dashed rgba(57,73,171,0.35)"
          : `1.5px solid ${T.accent}`,
        boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
        padding: "0 16px 0 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "border 0.2s",
        fontFamily: T.font,
      }}
    >
      {isEmpty ? (
        <span style={{ fontSize: T.sizeBody, color: T.textTertiary }}>
          Explore a game to see detailed stats here
        </span>
      ) : (
        games.map((game) => (
          <GamePill
            key={game.gameId}
            gameName={game.gameName}
            gameNumber={game.gameNumber}
            priceColor={priceColors[game.priceTier]}
            onRemove={() => onRemoveGame(game.gameId)}
          />
        ))
      )}
    </div>
  );
}
