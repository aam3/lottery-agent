# Calculated Metrics Reference

Index of all calculated metrics in the lottery scratcher system. Grouped by how metrics relate to and depend on each other.

---

## Key Terms

**Net value** = `prize_value - price_tier`. This is the profit or loss from a single ticket. A positive net value means the prize exceeds the cost of the ticket. A negative net value means the prize is worth less than what was paid. Throughout this document, references to "winning", "losing", and "breaking even" are based on net value.

**IMPORTANT**: All calculations must use net value rather than raw prize value. The cost of the ticket should always be factored in.

---

## Probability Distribution

Core win/loss probabilities for a game based on original ticket counts.

### p_losing

Probability of losing (net value < 0).

- **Table:** `game_metrics`
- **Field:** `p_losing`
- **Calculation:**
  ```
  p_losing = (tickets_printed - winning_tickets) / tickets_printed
  ```

### p_breaking_even

Probability of breaking even (net value = 0, includes free tickets where prize_value == price_tier).

- **Table:** `game_metrics`
- **Field:** `p_breaking_even`
- **Calculation:**
  ```
  p_breaking_even = break_even_tickets / tickets_printed
  ```
  Where `break_even_tickets` = tickets with `prize_value == price_tier`.

### p_winning_cash

Probability of winning cash (net value > 0, excludes free tickets).

- **Table:** `game_metrics`
- **Field:** `p_winning_cash`
- **Calculation:**
  ```
  p_winning_cash = cash_winning_tickets / tickets_printed
  ```
  Where `cash_winning_tickets` = tickets with `prize_value > price_tier` and `is_free_ticket == false`.

---

## Marginal Odds

Probability of winning at least a given dollar amount. One value per threshold.

Thresholds: `[0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000]`

### mo_0 through mo_100000

- **Table:** `game_metrics`
- **Fields:** `mo_0`, `mo_10`, `mo_50`, `mo_100`, `mo_500`, `mo_1000`, `mo_5000`, `mo_10000`, `mo_50000`, `mo_100000`
- **Calculation:**
  ```
  net_value = prize_value - price_tier
  mo_{threshold} = Σ(total_tickets where net_value >= threshold) / tickets_printed
  ```
  `mo_0` equals `1 - p_losing` by definition.

---

## Risk, Reward, and Value Scores (IN PROGRESS -- not finalized)

These metrics assess how favorable a game is relative to other games. Reward and risk are components used to derive ROI, which is then normalized into the value score.

### reward_raw

Average net value per winning ticket (where net value > 0). Based on current prizes remaining.

- **Table:** `game_metrics`
- **Field:** `reward_raw`
- **Calculation:**
  ```
  net_value = prize_value - price_tier
  reward_raw = Σ(net_value × prizes_remaining / winning_tickets_remaining)
               for prizes where net_value > 0
  ```

### risk_raw

Average net loss per losing ticket (where net value < 0), including LOSING prize rows (prize_value = 0).

- **Table:** `game_metrics`
- **Field:** `risk_raw`
- **Calculation:**
  ```
  net_value = prize_value - price_tier
  risk_raw = Σ(abs(net_value) × prizes_remaining / all_losing_remaining)
             for prizes where net_value < 0
  ```
  The LOSING prize rows (prize_value = 0, net_value = -price_tier) are included in this sum.

### roi

Return on investment per dollar spent. Negative means net loss.

- **Table:** `game_metrics`
- **Field:** `roi`
- **Calculation:**
  ```
  roi = (reward_raw - risk_raw) / price_tier
  ```

### value_score

ROI normalized to 0-100 across all active games in the same state using min-max scaling.

- **Table:** `game_metrics`
- **Field:** `value_score`
- **Calculation:**
  ```
  value_score = ((roi - roi_min) / (roi_max - roi_min)) × 100
  ```
  Where `roi_min` and `roi_max` are across all active games in the same state. If all games have the same ROI, `value_score = 50.0`.

  Value score is the price-aware measure — it weighs the reward against what you pay (risk vs reward). That's why value score leads when context is thin, not raw win-anything odds. Treat win-anything odds as an input, always read against price — never as a standalone "best."

---

## Prize Depletion Bands (IN PROGRESS -- not finalized)

Groups prize tiers into dollar bands and computes what percentage of prizes remain vs. original supply. These are moving from the website to the scraper.

### depletion_high

Percentage of $500+ prizes remaining vs. original.

- **Table:** `game_metrics`
- **Field:** `depletion_high`
- **Calculation:**
  ```
  depletion_high = round(Σ(prizes_remaining) / Σ(total_tickets) × 100)
                   for prizes where prize_value >= 500
  ```

### depletion_mid

Percentage of $50-$499 prizes remaining vs. original.

- **Table:** `game_metrics`
- **Field:** `depletion_mid`
- **Calculation:**
  ```
  depletion_mid = round(Σ(prizes_remaining) / Σ(total_tickets) × 100)
                  for prizes where prize_value >= 50 and prize_value < 500
  ```

### depletion_low

Percentage of under-$50 prizes remaining vs. original.

- **Table:** `game_metrics`
- **Field:** `depletion_low`
- **Calculation:**
  ```
  depletion_low = round(Σ(prizes_remaining) / Σ(total_tickets) × 100)
                  for prizes where prize_value < 50
  ```

**Note on `total_tickets` fallback:** When `total_tickets` is not available for a prize tier, use the most recent highest `prizes_remaining` value from the `prize_snapshots` table. Some game supplies are replenished, so the fallback must use the value after replenishment, not before -- the new total tickets value is the replenishment value.

NULL when no prizes exist in a given band.
