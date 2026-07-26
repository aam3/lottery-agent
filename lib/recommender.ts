// ─── Lottery Bundle Recommender ──────────────────────────────────────────────
//
// One entry point: recommend(games, budget, goal, risk).
// Internal router dispatches to one of three methods:
//   Method 1 (Coverage)    — goal is "win anything" (goal=0) → greedy knapsack
//   Method 2 (Single-Hit)  — dollar goal, stacking impossible → greedy knapsack
//   Method 3 (Full Search) — dollar goal, stacking possible → beam search + DP
//
// All probabilities use SUM(prizes_remaining) as denominator.
// A = P(win anything) always via closed form, never from convolution.

// ─── Config ─────────────────────────────────────────────────────────────────

export const CONFIG = {
  RISK_FLOOR: { high: 0.0, mid: 0.5, low: 0.85 } as Record<Risk, number>,
  BEAM_WIDTH: 8,
  MAX_STEPS: 6,
  MAX_BUCKETS: 2000,
  FEASIBLE_EPS: 0.02,
  ESCALATE_TO: 0.50,
  DIVERSITY: 2, // Diversity factor. 1 = no constraint. Higher = more spread across price tiers at large budgets.
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export type Risk = "low" | "mid" | "high";

export interface Tier {
  prizeValue: number;
  remaining: number;
}

export interface GameData {
  gameId: number;
  gameName: string;
  gameNumber: string;
  price: number;
  imageUrl: string | null;
  tiers: Tier[];           // winning tiers only (prizeValue > 0, remaining > 0)
  totalRemaining: number;  // SUM(prizes_remaining) across ALL tiers including LOSING
}

export interface BundleEntry {
  gameId: number;
  gameName: string;
  gameNumber: string;
  qty: number;
  price: number;
  spend: number;
  imageUrl: string | null;
}

export interface RoutingTrace {
  method: "coverage" | "single_hit" | "full_search";
  reason: string;
  arithmetic: Record<string, number>;
}

export interface RecommendResult {
  status: "ok" | "goal_unreachable" | "goal_unreachable_at_risk" | "budget_too_small";
  recommended: BundleEntry[];
  pReachGoal: number;
  pWinAnything: number;
  ceilingProb?: number;
  message: string;
  routingTrace: RoutingTrace;
}

// Internal bundle representation used during search
export interface Bundle {
  qty: Map<number, number>;  // gameId → ticket count
  cost: number;
  A: number;  // P(win anything)
  B: number;  // P(reach goal)
}

// ─── Derived Quantities ─────────────────────────────────────────────────────

/** Probability of winning (net profit >= 0): only tiers where prize >= ticket price. */
export function pWin(game: GameData): number {
  const winningRemaining = game.tiers
    .filter((t) => t.prizeValue >= game.price)
    .reduce((sum, t) => sum + t.remaining, 0);
  return winningRemaining / game.totalRemaining;
}

/** Probability of net profit >= G on a single ticket. Uses net value (prizeValue - price). */
export function pGeG(game: GameData, G: number): number {
  const qualifying = game.tiers
    .filter((t) => (t.prizeValue - game.price) >= G)
    .reduce((sum, t) => sum + t.remaining, 0);
  return qualifying / game.totalRemaining;
}

export function ev(game: GameData): number {
  const weightedSum = game.tiers.reduce(
    (sum, t) => sum + t.prizeValue * t.remaining,
    0
  );
  return weightedSum / game.totalRemaining;
}

export function evPerDollar(game: GameData): number {
  return ev(game) / game.price;
}

export function topPrize(game: GameData): number {
  return game.tiers.reduce(
    (max, t) => (t.remaining > 0 && t.prizeValue > max ? t.prizeValue : max),
    0
  );
}

// ─── Router ─────────────────────────────────────────────────────────────────

export function route(
  games: GameData[],
  budget: number,
  goal: number
): RoutingTrace {
  // Condition A: goal is "win anything" or goal <= smallest net profit in catalog
  const smallestNetProfit = Math.min(
    ...games.flatMap((g) =>
      g.tiers
        .filter((t) => t.remaining > 0 && t.prizeValue > g.price)
        .map((t) => t.prizeValue - g.price)
    )
  );

  if (goal === 0 || goal <= smallestNetProfit) {
    return {
      method: "coverage",
      reason:
        goal === 0
          ? "Goal is 'win anything' (goal=0)."
          : `Goal $${goal} is at or below the smallest net profit ($${smallestNetProfit}); any cash win satisfies it.`,
      arithmetic: { goal, smallestNetProfit },
    };
  }

  // Condition B: stacking test
  const cheapestPrice = Math.min(...games.map((g) => g.price));
  const maxTickets = Math.floor(budget / cheapestPrice);

  // pMax = largest net profit strictly below G, across all games, with remaining > 0
  let pMax = 0;
  for (const g of games) {
    for (const t of g.tiers) {
      const netProfit = t.prizeValue - g.price;
      if (t.remaining > 0 && netProfit > 0 && netProfit < goal && netProfit > pMax) {
        pMax = netProfit;
      }
    }
  }

  const stackingPotential = maxTickets * pMax;

  if (maxTickets < 2 || stackingPotential < goal) {
    return {
      method: "single_hit",
      reason: `Stacking cannot reach $${goal}: max_tickets=${maxTickets}, largest sub-goal prize=$${pMax}, ${maxTickets}×$${pMax}=$${stackingPotential} < $${goal}.`,
      arithmetic: { goal, cheapestPrice, maxTickets, pMax, stackingPotential },
    };
  }

  return {
    method: "full_search",
    reason: `Stacking can reach $${goal}: max_tickets=${maxTickets}, largest sub-goal prize=$${pMax}, ${maxTickets}×$${pMax}=$${stackingPotential} >= $${goal}.`,
    arithmetic: { goal, cheapestPrice, maxTickets, pMax, stackingPotential },
  };
}

// ─── Bundle Helpers ─────────────────────────────────────────────────────────

export function createBundle(): Bundle {
  return { qty: new Map(), cost: 0, A: 0, B: 0 };
}

export function addToBundle(
  bundle: Bundle,
  game: GameData,
  n: number
): Bundle {
  const newQty = new Map(bundle.qty);
  newQty.set(game.gameId, (newQty.get(game.gameId) ?? 0) + n);
  return {
    qty: newQty,
    cost: bundle.cost + n * game.price,
    A: 0,
    B: 0,
  };
}

export function computeCoverage(
  bundle: Bundle,
  gamesLut: Map<number, GameData>
): number {
  let loss = 1.0;
  for (const [gameId, n] of bundle.qty) {
    const game = gamesLut.get(gameId)!;
    loss *= Math.pow(1 - pWin(game), n);
  }
  return 1 - loss;
}

function describeBundleEntries(
  bundle: Bundle,
  gamesLut: Map<number, GameData>
): BundleEntry[] {
  const entries: BundleEntry[] = [];
  for (const [gameId, qty] of bundle.qty) {
    const game = gamesLut.get(gameId)!;
    entries.push({
      gameId: game.gameId,
      gameName: game.gameName,
      gameNumber: game.gameNumber,
      qty,
      price: game.price,
      spend: qty * game.price,
      imageUrl: game.imageUrl,
    });
  }
  return entries.sort((a, b) => b.spend - a.spend);
}

// ─── Method 1: Coverage ─────────────────────────────────────────────────────

function coverageMethod(
  games: GameData[],
  budget: number,
  trace: RoutingTrace,
  maxPerPrice: number
): RecommendResult {
  // Coverage density: -ln(1 - pWin) / price
  // Higher = more coverage per dollar
  const ranked = games
    .filter((g) => pWin(g) > 0)
    .map((g) => ({
      game: g,
      density: -Math.log(1 - pWin(g)) / g.price,
    }))
    .sort((a, b) => b.density - a.density);

  const bundle = createBundle();
  let remaining = budget;
  let current = bundle;
  const usedAtPrice = new Map<number, number>();

  for (const { game } of ranked) {
    if (game.price > remaining) continue;
    const atPrice = usedAtPrice.get(game.price) || 0;
    const priceHeadroom = maxPerPrice - atPrice;
    if (priceHeadroom <= 0) continue;
    const maxByBudget = Math.floor(remaining / game.price);
    const maxBySupply = game.totalRemaining;
    const k = Math.min(maxByBudget, maxBySupply, priceHeadroom);
    if (k <= 0) continue;
    current = addToBundle(current, game, k);
    remaining -= k * game.price;
    usedAtPrice.set(game.price, atPrice + k);
    if (remaining <= 0) break;
  }

  const gamesLut = new Map(games.map((g) => [g.gameId, g]));
  const A = computeCoverage(current, gamesLut);

  return {
    status: "ok",
    recommended: describeBundleEntries(current, gamesLut),
    pReachGoal: A, // any win = reaching goal=0
    pWinAnything: A,
    message: `P(win anything) = ${(A * 100).toFixed(1)}%. This bundle maximizes your chance of winning something within your $${budget} budget.`,
    routingTrace: trace,
  };
}

// ─── Method 2: Single-Hit ───────────────────────────────────────────────────

function singleHitMethod(
  games: GameData[],
  budget: number,
  goal: number,
  risk: Risk,
  trace: RoutingTrace,
  maxPerPrice: number
): RecommendResult {
  const gamesLut = new Map(games.map((g) => [g.gameId, g]));

  // Feasibility gate: does any game have a tier >= goal with remaining > 0?
  const eligible = games.filter(
    (g) => g.tiers.some((t) => t.prizeValue >= goal && t.remaining > 0)
  );

  if (eligible.length === 0) {
    return {
      status: "goal_unreachable",
      recommended: [],
      pReachGoal: 0,
      pWinAnything: 0,
      message: `No active game has a prize of $${goal} or more with tickets remaining. Consider lowering your goal.`,
      routingTrace: trace,
    };
  }

  // Single-hit density: -ln(1 - pGeG(game, goal)) / price
  const ranked = eligible
    .map((g) => {
      const p = pGeG(g, goal);
      return {
        game: g,
        p,
        density: p > 0 ? -Math.log(1 - p) / g.price : 0,
      };
    })
    .filter((e) => e.density > 0)
    .sort((a, b) => b.density - a.density);

  if (ranked.length === 0) {
    return {
      status: "goal_unreachable",
      recommended: [],
      pReachGoal: 0,
      pWinAnything: 0,
      message: `No game has remaining tickets that pay $${goal} or more. Consider lowering your goal.`,
      routingTrace: trace,
    };
  }

  // Greedy fill by density
  const bundle = createBundle();
  let remaining = budget;
  let current = bundle;
  const usedAtPrice = new Map<number, number>();

  for (const { game } of ranked) {
    if (game.price > remaining) continue;
    const atPrice = usedAtPrice.get(game.price) || 0;
    const priceHeadroom = maxPerPrice - atPrice;
    if (priceHeadroom <= 0) continue;
    const maxByBudget = Math.floor(remaining / game.price);
    const maxBySupply = game.totalRemaining;
    const k = Math.min(maxByBudget, maxBySupply, priceHeadroom);
    if (k <= 0) continue;
    current = addToBundle(current, game, k);
    remaining -= k * game.price;
    usedAtPrice.set(game.price, atPrice + k);
    if (remaining <= 0) break;
  }

  // P(reach G) = 1 - product((1 - pGeG(g, goal))^k) for purchased games
  let allMiss = 1.0;
  for (const [gameId, n] of current.qty) {
    const game = gamesLut.get(gameId)!;
    allMiss *= Math.pow(1 - pGeG(game, goal), n);
  }
  const pReach = 1 - allMiss;
  const A = computeCoverage(current, gamesLut);

  // Risk conflict: Method 2 is inherently a high-risk play (needs a single big hit).
  // If user is low/mid risk, escalate with tradeoff explanation.
  if (risk !== "high") {
    return {
      status: "goal_unreachable_at_risk",
      recommended: describeBundleEntries(current, gamesLut),
      pReachGoal: round4(pReach),
      pWinAnything: round4(A),
      message:
        `Reaching $${goal} on a $${budget} budget is only possible with a single high-tier hit — ` +
        `that's a ${(pReach * 100).toFixed(1)}% chance, which is a high-risk play. ` +
        `This doesn't match your ${risk}-risk tolerance. Your options: ` +
        `accept the long-shot anyway, lower your goal to something more reachable at this budget, ` +
        `or raise your budget.`,
      routingTrace: trace,
    };
  }

  return {
    status: "ok",
    recommended: describeBundleEntries(current, gamesLut),
    pReachGoal: round4(pReach),
    pWinAnything: round4(A),
    message:
      `P(win $${goal}+) = ${(pReach * 100).toFixed(1)}%, P(win anything) = ${(A * 100).toFixed(1)}%. ` +
      `At this budget, the only path to $${goal} is a single ticket hitting a high-tier prize.`,
    routingTrace: trace,
  };
}

// ─── Method 3: Full Search ──────────────────────────────────────────────────
//
// Non-separable objective: B = P(W >= G) requires convolving prize distributions.
// Pipeline: prefilter → beam search (scored by capped DP) → Pareto frontier → floor select.

// ── Convolution primitives ──────────────────────────────────────────────────

/** Adaptive resolution: exact ($1) for small goals, coarser for large ones. */
export function resAndCap(G: number): { res: number; cap: number } {
  const res = G <= CONFIG.MAX_BUCKETS ? 1 : Math.ceil(G / CONFIG.MAX_BUCKETS);
  const cap = Math.ceil(G / res);
  return { res, cap };
}

/** Single-ticket PMF bucketed by net profit (prizeValue - price) at $res, absorbing at index cap (>= G). */
export function gamePmf(game: GameData, res: number, cap: number): Float64Array {
  const d = new Float64Array(cap + 1);
  let won = 0;
  for (const t of game.tiers) {
    if (t.remaining <= 0) continue;
    const p = t.remaining / game.totalRemaining;
    const netProfit = t.prizeValue - game.price;
    if (netProfit <= 0) {
      // Break-even or loss: fold into loss mass at index 0
      d[0] += p;
    } else {
      const bucket = Math.min(Math.floor(netProfit / res), cap);
      d[bucket] += p;
    }
    won += p;
  }
  d[0] += 1.0 - won; // remaining loss mass (tickets with no winning tier)
  return d;
}

/** Naive O(n*m) convolution, folding overflow into absorbing cap bucket. */
export function convolveNaive(
  a: Float64Array,
  b: Float64Array,
  cap: number
): Float64Array {
  const out = new Float64Array(cap + 1);
  for (let i = 0; i <= cap; i++) {
    if (a[i] === 0) continue;
    for (let j = 0; j <= cap; j++) {
      if (b[j] === 0) continue;
      const idx = Math.min(i + j, cap);
      out[idx] += a[i] * b[j];
    }
  }
  return out;
}

// ── FFT convolution for large arrays ────────────────────────────────────────

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * In-place radix-2 Cooley-Tukey FFT.
 * Data is interleaved [re0, im0, re1, im1, ...] in a Float64Array of length 2*N.
 * inverse=true for inverse FFT (applies 1/N scaling).
 */
function fftInPlace(data: Float64Array, inverse: boolean): void {
  const N = data.length >> 1;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      // Swap complex elements i and j
      let tmp = data[2 * i]; data[2 * i] = data[2 * j]; data[2 * j] = tmp;
      tmp = data[2 * i + 1]; data[2 * i + 1] = data[2 * j + 1]; data[2 * j + 1] = tmp;
    }
  }

  // Butterfly stages
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const angle = (sign * 2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < half; j++) {
        const eRe = data[2 * (i + j)];
        const eIm = data[2 * (i + j) + 1];
        const oRe = data[2 * (i + j + half)];
        const oIm = data[2 * (i + j + half) + 1];
        const tRe = curRe * oRe - curIm * oIm;
        const tIm = curRe * oIm + curIm * oRe;
        data[2 * (i + j)] = eRe + tRe;
        data[2 * (i + j) + 1] = eIm + tIm;
        data[2 * (i + j + half)] = eRe - tRe;
        data[2 * (i + j + half) + 1] = eIm - tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < data.length; i++) {
      data[i] /= N;
    }
  }
}

/** FFT-based convolution, folding overflow into absorbing cap bucket. */
export function convolveFFT(
  a: Float64Array,
  b: Float64Array,
  cap: number
): Float64Array {
  const resultLen = a.length + b.length - 1;
  const N = nextPow2(resultLen);

  // Pack into interleaved complex arrays
  const fa = new Float64Array(2 * N);
  const fb = new Float64Array(2 * N);
  for (let i = 0; i < a.length; i++) fa[2 * i] = a[i];
  for (let i = 0; i < b.length; i++) fb[2 * i] = b[i];

  fftInPlace(fa, false);
  fftInPlace(fb, false);

  // Pointwise complex multiply: fa = fa * fb
  for (let i = 0; i < N; i++) {
    const aRe = fa[2 * i], aIm = fa[2 * i + 1];
    const bRe = fb[2 * i], bIm = fb[2 * i + 1];
    fa[2 * i] = aRe * bRe - aIm * bIm;
    fa[2 * i + 1] = aRe * bIm + aIm * bRe;
  }

  fftInPlace(fa, true);

  // Extract real part, truncate to cap+1, fold overflow into cap
  const out = new Float64Array(cap + 1);
  for (let i = 0; i < resultLen; i++) {
    const idx = Math.min(i, cap);
    out[idx] += fa[2 * i]; // real part
  }
  return out;
}

/** Dispatcher: picks naive or FFT based on effective array sizes. */
const FFT_THRESHOLD = 200;

export function convolveCap(
  a: Float64Array,
  b: Float64Array,
  cap: number
): Float64Array {
  if (a.length + b.length <= FFT_THRESHOLD) {
    return convolveNaive(a, b, cap);
  }
  return convolveFFT(a, b, cap);
}

/**
 * n-fold self-convolution via exponentiation by squaring.
 * Matches Python _self_conv: identity at n=0, pmf at n=1.
 */
export function selfConvolve(
  pmf: Float64Array,
  n: number,
  cap: number
): Float64Array {
  let result: Float64Array = new Float64Array(cap + 1);
  result[0] = 1.0; // identity: all mass at $0
  let base: Float64Array = pmf;
  let remaining = n;
  while (remaining > 0) {
    if (remaining & 1) {
      result = convolveCap(result, base, cap) as Float64Array;
    }
    remaining >>= 1;
    if (remaining > 0) {
      base = convolveCap(base, base, cap) as Float64Array;
    }
  }
  return result;
}

/** Compute B = P(W >= G) for a bundle via capped convolution DP. */
export function probReachG(
  bundle: Bundle,
  gamesLut: Map<number, GameData>,
  res: number,
  cap: number,
  memo: Map<string, Float64Array>
): number {
  let dist: Float64Array = new Float64Array(cap + 1);
  dist[0] = 1.0;
  for (const [gameId, n] of bundle.qty) {
    const key = `${gameId}:${n}`;
    if (!memo.has(key)) {
      const game = gamesLut.get(gameId)!;
      memo.set(key, selfConvolve(gamePmf(game, res, cap), n, cap));
    }
    dist = convolveCap(dist, memo.get(key)!, cap) as Float64Array;
  }
  return dist[cap];
}

// ── Coverage bundle (A-endpoint for Pareto frontier) ────────────────────────

function coverageBundleForFrontier(
  candidates: GameData[],
  budget: number,
  maxPerPrice: number = Infinity
): Bundle {
  const ranked = candidates
    .filter((g) => pWin(g) > 0)
    .map((g) => ({ game: g, density: -Math.log(1 - pWin(g)) / g.price }))
    .sort((a, b) => b.density - a.density);

  let current = createBundle();
  let remaining = budget;
  const usedAtPrice = new Map<number, number>();
  for (const { game } of ranked) {
    if (game.price > remaining) continue;
    const atPrice = usedAtPrice.get(game.price) || 0;
    const priceHeadroom = maxPerPrice - atPrice;
    if (priceHeadroom <= 0) continue;
    const k = Math.min(
      Math.floor(remaining / game.price),
      game.totalRemaining,
      priceHeadroom
    );
    if (k <= 0) continue;
    current = addToBundle(current, game, k);
    remaining -= k * game.price;
    usedAtPrice.set(game.price, atPrice + k);
    if (remaining <= 0) break;
  }
  return current;
}

// ── Beam search ─────────────────────────────────────────────────────────────

function bundleKey(b: Bundle): string {
  return [...b.qty.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, n]) => `${id}:${n}`)
    .join(",");
}

function ticketsAtPrice(bundle: Bundle, price: number, gamesLut: Map<number, GameData>): number {
  let total = 0;
  for (const [gameId, n] of bundle.qty) {
    if (gamesLut.get(gameId)!.price === price) total += n;
  }
  return total;
}

function beamSearch(
  candidates: GameData[],
  gamesLut: Map<number, GameData>,
  budget: number,
  res: number,
  cap: number,
  memo: Map<string, Float64Array>,
  maxPerPrice: number = Infinity
): Bundle[] {
  let beam: Bundle[] = [createBundle()];
  const explored: Bundle[] = [];
  const seen = new Set<string>();

  for (let step = 0; step < CONFIG.MAX_STEPS; step++) {
    const next: Bundle[] = [];
    for (const b of beam) {
      const rem = budget - b.cost;
      for (const g of candidates) {
        if (g.price > rem) continue;
        const priceHeadroom = maxPerPrice - ticketsAtPrice(b, g.price, gamesLut);
        if (priceHeadroom <= 0) continue;
        // Coarse move (~1/3 of remaining budget) + fine move (1 ticket)
        const coarse = Math.min(Math.max(1, Math.floor((rem * 0.34) / g.price)), priceHeadroom);
        const quantities = new Set([coarse, 1]);
        for (const q of quantities) {
          if (q > priceHeadroom) continue;
          if (b.cost + q * g.price > budget) continue;
          const nb = addToBundle(b, g, q);
          const key = bundleKey(nb);
          if (seen.has(key)) continue;
          seen.add(key);
          nb.B = probReachG(nb, gamesLut, res, cap, memo);
          nb.A = computeCoverage(nb, gamesLut);
          explored.push(nb);
          next.push(nb);
        }
      }
    }
    if (next.length === 0) break;
    next.sort((a, b) => b.B - a.B);
    beam = next.slice(0, CONFIG.BEAM_WIDTH);
  }
  return explored;
}

// ── Pareto frontier + floor selection ────────────────────────────────────────

export function pareto(bundles: Bundle[]): Bundle[] {
  return bundles.filter(
    (b) =>
      !bundles.some(
        (o) => o.A >= b.A && o.B >= b.B && (o.A > b.A || o.B > b.B)
      )
  );
}

export function floorSelect(frontier: Bundle[], floor: number): Bundle | null {
  const ok = frontier.filter((b) => b.A >= floor);
  if (ok.length === 0) return null;
  return ok.reduce((best, b) =>
    b.B > best.B || (b.B === best.B && b.A > best.A) ? b : best
  );
}

// ── Budget probe (escalation) ───────────────────────────────────────────────

export function budgetProbe(
  candidates: GameData[],
  gamesLut: Map<number, GameData>,
  G: number,
  startBudget: number
): string {
  let b = startBudget;
  const { res, cap } = resAndCap(G);
  for (let i = 0; i < 8; i++) {
    b *= 1.5;
    const memo = new Map<string, Float64Array>();
    const explored = beamSearch(candidates, gamesLut, b, res, cap, memo);
    if (explored.length > 0) {
      const best = explored.reduce((a, c) => (c.B > a.B ? c : a));
      if (best.B >= CONFIG.ESCALATE_TO) {
        return `You'd need about $${Math.round(b)} for a ~50% shot.`;
      }
    }
  }
  return "Even at much higher budgets a 50% shot isn't reachable for these games.";
}

// ── Full search method (orchestrator) ───────────────────────────────────────

function fullSearchMethod(
  games: GameData[],
  budget: number,
  goal: number,
  risk: Risk,
  trace: RoutingTrace,
  maxPerPrice: number
): RecommendResult {
  const floor = CONFIG.RISK_FLOOR[risk];
  const { res, cap } = resAndCap(goal);
  const memo = new Map<string, Float64Array>();
  const gamesLut = new Map(games.map((g) => [g.gameId, g]));

  // Beam search (goal end) + coverage bundle (A end)
  const explored = beamSearch(games, gamesLut, budget, res, cap, memo, maxPerPrice);
  const cov = coverageBundleForFrontier(games, budget, maxPerPrice);
  cov.B = probReachG(cov, gamesLut, res, cap, memo);
  cov.A = computeCoverage(cov, gamesLut);
  explored.push(cov);

  // Stage 3: Pareto frontier
  const frontier = pareto(explored);
  const ceiling = explored.reduce((best, b) => (b.B > best.B ? b : best));

  // Stage 4: floor select
  const pick = floorSelect(frontier, floor);

  // Feasibility / escalation
  if (!pick || pick.B < CONFIG.FEASIBLE_EPS) {
    const fallback = explored
      .filter((b) => b.A >= floor)
      .reduce(
        (best, b) => (b.A > best.A ? b : best),
        cov
      );
    return {
      status: "goal_unreachable_at_risk",
      recommended: describeBundleEntries(fallback, gamesLut),
      pReachGoal: round4(pick?.B ?? 0),
      pWinAnything: round4(fallback.A),
      ceilingProb: round4(ceiling.B),
      message:
        `Best chance of reaching $${goal} while keeping your win-something odds >= ${(floor * 100).toFixed(0)}% ` +
        `is only ${((pick?.B ?? 0) * 100).toFixed(1)}%. ` +
        `Ignoring risk, the ceiling at this budget is ${(ceiling.B * 100).toFixed(1)}%.`,
      routingTrace: trace,
    };
  }

  // Exchange-rate explanation
  const dA = cov.A - pick.A;
  const message =
    risk !== "high"
      ? `P(reach $${goal}) = ${(pick.B * 100).toFixed(1)}%, P(win anything) = ${(pick.A * 100).toFixed(1)}%. ` +
        `Going further toward the goal would drop win-anything by ~${Math.max(dA * 100, 0).toFixed(0)}% ` +
        `for little gain — held back by your ${risk}-risk floor of ${(floor * 100).toFixed(0)}%.`
      : `P(reach $${goal}) = ${(pick.B * 100).toFixed(1)}% (all-in on the goal; win-anything = ${(pick.A * 100).toFixed(1)}%).`;

  return {
    status: "ok",
    recommended: describeBundleEntries(pick, gamesLut),
    pReachGoal: round4(pick.B),
    pWinAnything: round4(pick.A),
    ceilingProb: round4(ceiling.B),
    message,
    routingTrace: trace,
  };
}

// ─── Entry Point ────────────────────────────────────────────────────────────

export function recommend(
  games: GameData[],
  budget: number,
  goal: number,
  risk: Risk
): RecommendResult {
  // Budget too small for any ticket
  const cheapest = Math.min(...games.map((g) => g.price));
  if (budget < cheapest) {
    return {
      status: "budget_too_small",
      recommended: [],
      pReachGoal: 0,
      pWinAnything: 0,
      message: `Your $${budget} budget is below the cheapest ticket ($${cheapest}). No purchase possible.`,
      routingTrace: {
        method: "coverage",
        reason: "Budget below cheapest ticket price.",
        arithmetic: { budget, cheapestPrice: cheapest },
      },
    };
  }

  const trace = route(games, budget, goal);
  const totalTickets = Math.floor(budget / cheapest);
  const D = CONFIG.DIVERSITY;
  const divisor = D > 1
    ? Math.max(1, Math.pow(Math.log10(totalTickets / 5), D - 1))
    : 1;
  const maxPerPrice = D > 1
    ? Math.max(1, Math.floor(totalTickets / divisor))
    : Infinity;

  switch (trace.method) {
    case "coverage":
      return coverageMethod(games, budget, trace, maxPerPrice);
    case "single_hit":
      return singleHitMethod(games, budget, goal, risk, trace, maxPerPrice);
    case "full_search":
      return fullSearchMethod(games, budget, goal, risk, trace, maxPerPrice);
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
