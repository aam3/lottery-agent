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

  if (isEmpty) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "12px 0",
        borderBottom: `1px solid ${T.divider}`,
        fontFamily: T.font,
      }}
    >
      {games.map((game) => (
        <GamePill
          key={game.gameId}
          gameName={game.gameName}
          gameNumber={game.gameNumber}
          priceColor={priceColors[game.priceTier]}
          onRemove={() => onRemoveGame(game.gameId)}
        />
      ))}
    </div>
  );
}
