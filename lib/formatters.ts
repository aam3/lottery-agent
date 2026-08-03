// ─── Shared formatting helpers ─────────────────────────────────────────────
// Single source of truth for display formatting across chat blocks and dashboard.

/** Format prize value: $1M for ≥1M, $1K for ≥1K, $n otherwise */
export function formatPrize(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

/** Format win rate from p_losing: "35.2%" */
export function formatWinRate(pLosing: number): string {
  return `${((1 - pLosing) * 100).toFixed(1)}%`;
}

/** Format ROI: "+12.3%" or "-5.1%" */
export function formatROI(roi: number): string {
  return roi >= 0 ? `+${(roi * 100).toFixed(1)}%` : `${(roi * 100).toFixed(1)}%`;
}

/** Format odds as percentage: "0.053%" for small values, "12.3%" for larger */
export function formatOdds(probability: number): string {
  if (probability <= 0) return "—";
  return `${(probability * 100).toFixed(3)}%`;
}

/** Default marginal odds thresholds used by odds chart and marginal odds computation */
export const DEFAULT_THRESHOLDS = [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];
