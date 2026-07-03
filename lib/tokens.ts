export const T = {
  // Font
  font: "'Outfit', sans-serif",

  // Type scale
  sizePageTitle: 24,
  sizeDisplay: 20,
  sizeTitle: 16,
  sizeBody: 13,
  sizeSmall: 12,
  sizeLabel: 11,
  sizeCaption: 10,

  // Weights
  weightPageTitle: 500,
  weightDisplay: 600,
  weightTitle: 500,
  weightBody: 400,
  weightSmall: 400,
  weightLabel: 500,
  weightCategory: 600,
  weightCaption: 400,

  // Line heights
  lhPageTitle: 1.25,
  lhDisplay: 1.2,
  lhTitle: 1.3,
  lhBody: 1.55,
  lhSmall: 1.5,
  lhLabel: 1.3,
  lhCaption: 1.5,

  // Text colors — three-tier hierarchy
  textPrimary: "#2c2924",
  textSecondary: "#8a8176",
  textTertiary: "#918779",

  // Surface colors
  pageBg: "#f7f3e8",
  cardBg: "#ffffff",
  pickBg: "#fbf9f1",
  accent: "#3949AB",
  border: "#d8d0bc",
  divider: "#e8e2d2",
  cardRadius: 10,
  cardShadow: "0 2px 6px rgba(0,0,0,0.04)",
  dropdownShadow: "0 4px 12px rgba(0,0,0,0.1)",
  tooltipBg: "rgba(0,0,0,0.85)",
  badgeBg: "#f0ede6",
  badgeText: "#2c2924",
  badgeBorder: "#c8c3b8",
  hoverBg: "#f7f3e8",
  smallRadius: 6,
  pillRadius: 10,
  modalRadius: 14,
  modalShadow: "0 12px 40px rgba(0,0,0,0.15)",
} as const;

export const PRICE_PALETTE = [
  "#FFD21F", "#E8692E", "#77BBDA", "#7986CB",
  "#283593", "#9B377E", "#C2185B", "#880E4F",
] as const;

export function buildPriceColors(priceTiers: number[]): Record<number, string> {
  const sorted = [...priceTiers].sort((a, b) => a - b);
  const map: Record<number, string> = {};
  sorted.forEach((tier, i) => {
    map[tier] = PRICE_PALETTE[i % PRICE_PALETTE.length];
  });
  return map;
}

export const OUTCOME_COLORS = {
  lose: "#FF787B",
  even: "#FFE787",
  win: "#18C284",
} as const;

// Composed style patterns
export const S = {
  card: {
    background: T.cardBg,
    borderRadius: T.cardRadius,
    boxShadow: T.cardShadow,
  },
  tooltip: {
    background: T.tooltipBg,
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 12,
    color: "#fff" as const,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: T.sizeTitle,
    fontWeight: T.weightTitle,
    color: T.textPrimary,
    lineHeight: T.lhTitle,
  },
  metricLabel: {
    fontSize: T.sizeCaption,
    fontWeight: T.weightLabel,
    color: T.textSecondary,
    letterSpacing: 0.5,
  },
  chartTick: {
    fontSize: T.sizeLabel,
    fill: T.textSecondary,
  },
  chartAxisLabel: {
    fontSize: T.sizeSmall,
    fill: T.textSecondary,
  },
  chartCursor: {
    stroke: T.textTertiary,
    strokeDasharray: "4 4",
  },
} as const;
