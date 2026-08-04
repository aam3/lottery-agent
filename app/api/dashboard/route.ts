import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { formatPrize, formatWinRate, formatROI, formatOdds, DEFAULT_THRESHOLDS } from "@/lib/formatters";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardGame {
  gameId: number;
  gameName: string;
  gameNumber: string;
  priceTier: number;
  imageUrl: string | null;
}

interface StatsTable {
  columns: { label: string }[];
  rows: { label: string; priceTier?: number; values: string[] }[];
}

interface OddsChartGame {
  game_name: string;
  game_number: string;
  price_tier: number;
  top_prize_value: number;
  marginal_odds: Record<string, number>;
}

interface OutcomeGame {
  game_name: string;
  game_number: string;
  price_tier: number;
  p_losing: number;
  p_breaking_even: number;
  p_winning_cash: number;
}

interface ScatterGame {
  game_id: number;
  game_name: string;
  game_number: string;
  price_tier: number;
  risk_scaled: number;
  reward_scaled: number;
  avg_cash_prize: number;
  top_prize_value: number;
}

interface DashboardResponse {
  games: DashboardGame[];
  statsTable: StatsTable;
  oddsChart: { games: OddsChartGame[] };
  outcomeBars: { games: OutcomeGame[] };
  scatter: { highlighted: ScatterGame[]; context: ScatterGame[] };
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameIdsParam = searchParams.get("gameIds");
  const gameNumbersParam = searchParams.get("gameNumbers");
  const state = searchParams.get("state");

  if (!state) {
    return NextResponse.json({ error: "state required" }, { status: 400 });
  }
  if (!gameIdsParam && !gameNumbersParam) {
    return NextResponse.json({ error: "gameIds or gameNumbers required" }, { status: 400 });
  }

  let gameIds: number[];

  if (gameIdsParam) {
    gameIds = gameIdsParam.split(",").map(Number).filter((n) => !isNaN(n));
  } else {
    // Resolve game IDs from game numbers + state
    const gameNumbers = gameNumbersParam!.split(",").map((s) => s.trim());
    const lookup = await sql`
      SELECT game_id FROM games
      WHERE state = ${state.toUpperCase()} AND game_number = ANY(${gameNumbers})
    `;
    if (lookup.length === 0) {
      return NextResponse.json({ error: "No games found for those game numbers" }, { status: 404 });
    }
    gameIds = lookup.map((r) => r.game_id as number);
  }

  if (gameIds.length === 0) {
    return NextResponse.json({ error: "gameIds required" }, { status: 400 });
  }
  if (gameIds.length > 4) {
    return NextResponse.json({ error: "Maximum 4 games" }, { status: 400 });
  }

  try {
    // ── 1. Game info + metrics ─────────────────────────────────────────────
    const metricRows = await sql`
      SELECT gm.game_id, g.game_name, g.game_number, g.price_tier, g.image_url,
             gm.p_losing, gm.p_breaking_even, gm.p_winning_cash, gm.roi,
             gm.reward_raw, gm.risk_raw
      FROM game_metrics gm
      JOIN games g ON g.game_id = gm.game_id
      WHERE gm.game_id = ANY(${gameIds})
    `;

    // Validate all requested games were found
    const foundIds = new Set(metricRows.map((r) => r.game_id as number));
    for (const id of gameIds) {
      if (!foundIds.has(id)) {
        return NextResponse.json({ error: `Game not found: ${id}` }, { status: 404 });
      }
    }

    // ── 2. Prize data (for odds chart + top prize + avg_cash_prize) ────────
    const prizeRows = await sql`
      SELECT p.game_id, p.prize_value, p.prizes_remaining, p.is_free_ticket,
             g.price_tier
      FROM prizes p
      JOIN games g ON g.game_id = p.game_id
      WHERE p.game_id = ANY(${gameIds})
      ORDER BY p.game_id, p.prize_value DESC NULLS LAST
    `;

    // Group prize data by game
    const prizesByGame = new Map<number, {
      tiers: { prize_value: number | null; prizes_remaining: number; is_free_ticket: boolean }[];
      totalRemaining: number;
      topPrizeValue: number;
      topPrizesRemaining: number | null;
    }>();

    for (const r of prizeRows) {
      const gid = r.game_id as number;
      const remaining = r.prizes_remaining as number;
      if (!prizesByGame.has(gid)) {
        prizesByGame.set(gid, {
          tiers: [],
          totalRemaining: 0,
          topPrizeValue: 0,
          topPrizesRemaining: null,
        });
      }
      const gData = prizesByGame.get(gid)!;
      gData.totalRemaining += remaining;
      gData.tiers.push({
        prize_value: r.prize_value as number | null,
        prizes_remaining: remaining,
        is_free_ticket: r.is_free_ticket as boolean,
      });
      if (gData.topPrizeValue === 0 && r.prize_value !== null) {
        gData.topPrizeValue = r.prize_value as number;
        gData.topPrizesRemaining = remaining;
      }
    }

    // ── 3. Context games for scatter (ALL active games in state) ────────
    const contextRows = await sql`
      SELECT gm.game_id, g.game_name, g.game_number, g.price_tier,
             gm.reward_raw, gm.risk_raw
      FROM game_metrics gm
      JOIN games g ON g.game_id = gm.game_id
      WHERE g.state = ${state.toUpperCase()}
        AND g.is_active = true
        AND gm.game_id != ALL(${gameIds})
    `;

    // Also get top prize + avg_cash_prize for context games
    const contextIds = contextRows.map((r) => r.game_id as number);
    let contextPrizeMap = new Map<number, { topPrizeValue: number; avgCashPrize: number }>();
    if (contextIds.length > 0) {
      const contextPrizeRows = await sql`
        SELECT p.game_id, p.prize_value, p.prizes_remaining, p.is_free_ticket,
               g.price_tier
        FROM prizes p
        JOIN games g ON g.game_id = p.game_id
        WHERE p.game_id = ANY(${contextIds})
        ORDER BY p.game_id, p.prize_value DESC NULLS LAST
      `;
      contextPrizeMap = computePrizeStats(contextPrizeRows);
    }

    // ── Assemble response ─────────────────────────────────────────────────

    // Games list for tray
    const games: DashboardGame[] = metricRows.map((r) => ({
      gameId: r.game_id as number,
      gameName: r.game_name as string,
      gameNumber: r.game_number as string,
      priceTier: r.price_tier as number,
      imageUrl: (r.image_url as string | null),
    }));

    // Stats table
    const statsTable: StatsTable = {
      columns: [
        { label: "Top Prize" },
        { label: "Win Rate" },
        { label: "Odds $500+" },
        { label: "ROI" },
      ],
      rows: [],
    };

    // Odds chart + stats table rows + outcome bars
    const oddsChartGames: OddsChartGame[] = [];
    const outcomeGames: OutcomeGame[] = [];

    for (const game of metricRows) {
      const gid = game.game_id as number;
      const priceTier = game.price_tier as number;
      const pData = prizesByGame.get(gid);

      // Compute marginal odds
      const marginalOdds: Record<string, number> = {};
      if (pData && pData.totalRemaining > 0) {
        for (const t of DEFAULT_THRESHOLDS) {
          const qualifying = pData.tiers
            .filter(
              (tier) =>
                tier.prize_value !== null &&
                tier.prizes_remaining > 0 &&
                (tier.prize_value - priceTier) >= t
            )
            .reduce((sum, tier) => sum + tier.prizes_remaining, 0);
          marginalOdds[String(t)] = qualifying / pData.totalRemaining;
        }
      }

      oddsChartGames.push({
        game_name: game.game_name as string,
        game_number: game.game_number as string,
        price_tier: priceTier,
        top_prize_value: pData?.topPrizeValue ?? 0,
        marginal_odds: marginalOdds,
      });

      const pLosing = game.p_losing as number;
      const roi = game.roi as number;
      const odds500 = marginalOdds["500"] ?? 0;

      statsTable.rows.push({
        label: `${game.game_name} (#${game.game_number})`,
        priceTier,
        values: [
          formatPrize(pData?.topPrizeValue ?? 0),
          formatWinRate(pLosing),
          formatOdds(odds500),
          formatROI(roi),
        ],
      });

      outcomeGames.push({
        game_name: game.game_name as string,
        game_number: game.game_number as string,
        price_tier: priceTier,
        p_losing: pLosing,
        p_breaking_even: game.p_breaking_even as number,
        p_winning_cash: game.p_winning_cash as number,
      });
    }

    // Scatter — compute scaled values across highlighted + context
    const allScatterGames = [
      ...metricRows.map((r) => ({
        game_id: r.game_id as number,
        game_name: r.game_name as string,
        game_number: r.game_number as string,
        price_tier: r.price_tier as number,
        reward_raw: r.reward_raw as number,
        risk_raw: r.risk_raw as number,
        highlighted: true,
      })),
      ...contextRows.map((r) => ({
        game_id: r.game_id as number,
        game_name: r.game_name as string,
        game_number: r.game_number as string,
        price_tier: r.price_tier as number,
        reward_raw: r.reward_raw as number,
        risk_raw: r.risk_raw as number,
        highlighted: false,
      })),
    ];

    // Min-max scale risk and reward to 0-10
    const riskValues = allScatterGames.map((g) => g.risk_raw).filter((v) => v != null);
    const rewardValues = allScatterGames.map((g) => g.reward_raw).filter((v) => v != null);
    const riskMin = Math.min(...riskValues);
    const riskMax = Math.max(...riskValues);
    const rewardMin = Math.min(...rewardValues);
    const rewardMax = Math.max(...rewardValues);
    const riskRange = riskMax - riskMin || 1;
    const rewardRange = rewardMax - rewardMin || 1;

    // Compute avg_cash_prize for highlighted games from prize data
    const highlightedPrizeStats = computePrizeStats(prizeRows);

    const toScatterGame = (g: typeof allScatterGames[0]): ScatterGame => {
      const prizeStats = g.highlighted
        ? highlightedPrizeStats.get(g.game_id)
        : contextPrizeMap.get(g.game_id);

      return {
        game_id: g.game_id,
        game_name: g.game_name,
        game_number: g.game_number,
        price_tier: g.price_tier,
        risk_scaled: ((g.risk_raw - riskMin) / riskRange) * 10,
        reward_scaled: ((g.reward_raw - rewardMin) / rewardRange) * 10,
        avg_cash_prize: prizeStats?.avgCashPrize ?? 0,
        top_prize_value: prizeStats?.topPrizeValue ?? 0,
      };
    };

    const highlighted = allScatterGames.filter((g) => g.highlighted).map(toScatterGame);
    const context = allScatterGames.filter((g) => !g.highlighted).map(toScatterGame);

    const response: DashboardResponse = {
      games,
      statsTable,
      oddsChart: { games: oddsChartGames },
      outcomeBars: { games: outcomeGames },
      scatter: { highlighted, context },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[dashboard] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 },
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute top prize value and avg cash prize from prize rows grouped by game */
function computePrizeStats(
  rows: Record<string, unknown>[],
): Map<number, { topPrizeValue: number; avgCashPrize: number }> {
  const map = new Map<number, {
    topPrizeValue: number;
    cashSum: number;
    cashCount: number;
  }>();

  for (const r of rows) {
    const gid = r.game_id as number;
    const prizeValue = r.prize_value as number | null;
    const remaining = r.prizes_remaining as number;
    const isFreeTicket = r.is_free_ticket as boolean;
    const priceTier = r.price_tier as number | undefined;

    if (!map.has(gid)) {
      map.set(gid, { topPrizeValue: 0, cashSum: 0, cashCount: 0 });
    }
    const entry = map.get(gid)!;

    if (prizeValue !== null) {
      if (entry.topPrizeValue === 0) {
        entry.topPrizeValue = prizeValue; // first row is highest (ORDER BY DESC)
      }
      // Cash-winning tiers: prize > cost and not free ticket
      if (!isFreeTicket && priceTier !== undefined && prizeValue > priceTier && remaining > 0) {
        entry.cashSum += prizeValue * remaining;
        entry.cashCount += remaining;
      }
    }
  }

  const result = new Map<number, { topPrizeValue: number; avgCashPrize: number }>();
  for (const [gid, entry] of map) {
    result.set(gid, {
      topPrizeValue: entry.topPrizeValue,
      avgCashPrize: entry.cashCount > 0 ? entry.cashSum / entry.cashCount : 0,
    });
  }
  return result;
}
