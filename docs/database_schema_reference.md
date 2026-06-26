# Database Schema Reference

Reference for all tables in the lottery scratcher database. Describes the purpose of each table and the fields it contains.

---

## states

One row per U.S. state lottery program.

| Column | Type | Nullable | Description |
|---|---|---|---|
| state_id | SERIAL | NO | Primary key |
| name | VARCHAR(50) | NO | Full state name (e.g., "New Jersey") |
| abbreviation | VARCHAR(2) | NO | 2-letter code (e.g., "NJ"). Unique across all rows. |
| lottery_url | VARCHAR(500) | YES | Root URL of the state lottery site |
| last_scraped_at | TIMESTAMPTZ | YES | Timestamp of the most recent completed scrape for this state |
| is_active | BOOLEAN | NO | Whether this state is currently being scraped |

---

## games

One row per scratch-off game within a state. A game is uniquely identified by `(game_number, state)`. Game names may repeat within a state across different editions.

| Column | Type | Nullable | Description |
|---|---|---|---|
| game_id | SERIAL | NO | Primary key |
| game_number | VARCHAR(20) | NO | State-assigned game identifier. Format varies by state (e.g., 5-digit zero-padded in NJ). |
| game_name | VARCHAR(255) | NO | Display name from the lottery site. Not unique -- editions reuse names. |
| state | VARCHAR(2) | NO | State abbreviation. Denormalized for query convenience. |
| state_id | INTEGER | YES | FK to `states.state_id`. Nullable for historical rows from before the states table was added. |
| price_tier | DECIMAL(10,2) | NO | Ticket purchase price in dollars |
| overall_odds | VARCHAR(50) | YES | Raw odds string from the site (e.g., "1 in 3.45"). NULL when the site doesn't publish odds. |
| overall_odds_numeric | DECIMAL(10,6) | YES | Parsed winning probability as a decimal (e.g., 0.289855). Derived from `overall_odds` or computed from `tickets_printed` and prize totals. |
| tickets_printed | INTEGER | YES | Total tickets printed for the entire game across all tiers. NULL when the site doesn't publish this. |
| game_url | VARCHAR(500) | YES | Detail page URL on the lottery site |
| image_url | VARCHAR(500) | YES | Ticket image URL |
| is_active | BOOLEAN | NO | Whether the game is currently on the state's active listing page. FALSE when retired. |
| created_at | TIMESTAMPTZ | NO | Row creation time |
| updated_at | TIMESTAMPTZ | NO | Last upsert time. Updated on every scrape that touches this game. |

---

## prizes

One row per prize tier for a game. Represents the current state of that tier as of the most recent scrape. Updated via upsert on each load.

| Column | Type | Nullable | Description |
|---|---|---|---|
| prize_id | SERIAL | NO | Primary key |
| game_id | INTEGER | NO | FK to `games.game_id` (CASCADE on delete) |
| prize_label | VARCHAR(100) | NO | Raw prize text from the site (e.g., "$10,000 A MONTH/LIF", "FREE $5 TICKET", "LOSING"). Preserved as-is. |
| prize_value | DECIMAL(12,2) | YES | Numeric dollar value of the prize. NULL for unresolvable labels. Free ticket prizes use the game's ticket price. Annuity prizes store the computed total payout. |
| total_tickets | INTEGER | YES | Total tickets printed for this specific prize tier. NULL when the site doesn't publish per-tier totals. |
| prizes_remaining | INTEGER | NO | Current number of unclaimed prizes in this tier |
| prize_odds | VARCHAR(50) | YES | Per-tier odds string (e.g., "1 in 1,000"). NULL when the site doesn't publish per-tier odds. |
| is_free_ticket | BOOLEAN | NO | Whether this tier is a free ticket prize |
| scrape_date | DATE | NO | Date of the most recent scrape that updated this row |
| created_at | TIMESTAMPTZ | NO | Row creation time |

---

## prize_snapshots

One row per prize tier per scrape date. Append-only historical record of remaining prize counts over time. Never updated or deleted directly.

| Column | Type | Nullable | Description |
|---|---|---|---|
| snapshot_id | SERIAL | NO | Primary key |
| prize_id | INTEGER | NO | FK to `prizes.prize_id` (CASCADE on delete) |
| prizes_remaining | INTEGER | NO | Remaining prize count as of `scrape_date` |
| scrape_date | DATE | NO | Date this snapshot was captured |
| created_at | TIMESTAMPTZ | NO | Row creation time |

---

## scraper_runs

One row per invocation of the scraper for a single state. Tracks the outcome and statistics of each run.

| Column | Type | Nullable | Description |
|---|---|---|---|
| run_id | SERIAL | NO | Primary key |
| state | VARCHAR(2) | NO | State code for this run |
| started_at | TIMESTAMPTZ | NO | When the run began |
| ended_at | TIMESTAMPTZ | YES | When the run finished. NULL while still running. |
| games_on_page | INTEGER | YES | Total games visible on the listing page |
| games_attempted | INTEGER | YES | Number of games the scraper tried to extract |
| games_succeeded | INTEGER | YES | Number of games successfully extracted |
| games_failed | INTEGER | YES | Number of games that failed extraction |
| failed_game_names | TEXT | YES | Comma-separated names of failed games. Legacy column being replaced by `scrape_failures` table. |
| status | VARCHAR(20) | NO | Run outcome: `running`, `success`, `partial`, or `failed` |
| error_message | TEXT | YES | Error details on failure |
| created_at | TIMESTAMPTZ | NO | Row creation time |

---

## scrape_failures (planned)

One row per game that failed extraction or validation during a scraper run. Structured replacement for the `failed_game_names` text column on `scraper_runs`.

| Column | Type | Nullable | Description |
|---|---|---|---|
| failure_id | SERIAL | NO | Primary key |
| run_id | INTEGER | NO | FK to `scraper_runs.run_id` (CASCADE on delete) |
| state | VARCHAR(2) | NO | State code |
| game_number | VARCHAR(20) | YES | Game number if known. NULL for listing-level failures. |
| game_name | VARCHAR(255) | YES | Game name if known |
| failure_type | VARCHAR(50) | NO | Category: `extraction`, `contract_validation`, `navigation`, or `timeout` |
| error_message | TEXT | YES | Detailed error description |
| created_at | TIMESTAMPTZ | NO | When the failure was recorded |

---

## game_metrics

One row per game containing derived analytical metrics. One-to-one with `games`. Recomputed after each scrape and load cycle.

| Column | Type | Nullable | Description |
|---|---|---|---|
| metric_id | SERIAL | NO | Primary key |
| game_id | INTEGER | NO | FK to `games.game_id` (CASCADE on delete). Unique -- enforces one-to-one with games. |
| p_losing | DECIMAL(10,8) | YES | Probability of losing (net value < 0) based on current prizes remaining |
| p_breaking_even | DECIMAL(10,8) | YES | Probability of breaking even (net value = 0, includes free tickets) |
| p_winning_cash | DECIMAL(10,8) | YES | Probability of winning cash (net value > 0) |
| mo_0 | DECIMAL(10,8) | YES | Marginal odds of net profit >= $0 |
| mo_10 | DECIMAL(10,8) | YES | Marginal odds of prize >= $10 |
| mo_50 | DECIMAL(10,8) | YES | Marginal odds of prize >= $50 |
| mo_100 | DECIMAL(10,8) | YES | Marginal odds of prize >= $100 |
| mo_500 | DECIMAL(10,8) | YES | Marginal odds of prize >= $500 |
| mo_1000 | DECIMAL(10,8) | YES | Marginal odds of prize >= $1,000 |
| mo_5000 | DECIMAL(10,8) | YES | Marginal odds of prize >= $5,000 |
| mo_10000 | DECIMAL(10,8) | YES | Marginal odds of prize >= $10,000 |
| mo_50000 | DECIMAL(10,8) | YES | Marginal odds of prize >= $50,000 |
| mo_100000 | DECIMAL(10,8) | YES | Marginal odds of prize >= $100,000 |
| reward_raw | DECIMAL(12,4) | YES | Average profit per winning ticket (where prize > cost) |
| risk_raw | DECIMAL(12,4) | YES | Average loss per losing ticket (where prize < cost) |
| roi | DECIMAL(12,6) | YES | Return on investment: `(reward_raw - risk_raw) / price_tier`. Negative means net loss. |
| value_score | DECIMAL(5,2) | YES | ROI normalized 0-100 via min-max across all active games in the same state |
| depletion_high | DECIMAL(5,2) | YES | Percentage of $500+ prizes remaining vs. original. NULL if no prizes in this band. |
| depletion_mid | DECIMAL(5,2) | YES | Percentage of $50-$499 prizes remaining vs. original. NULL if no prizes in this band. |
| depletion_low | DECIMAL(5,2) | YES | Percentage of under-$50 prizes remaining vs. original. NULL if no prizes in this band. |
| computed_at | TIMESTAMPTZ | NO | When these metrics were last recomputed |
| created_at | TIMESTAMPTZ | NO | Row creation time |

---

## game_metrics_snapshots

One row per game per scrape date. Append-only historical record of computed metrics over time. Never updated or deleted directly.

| Column | Type | Nullable | Description |
|---|---|---|---|
| snapshot_id | SERIAL | NO | Primary key |
| game_id | INTEGER | NO | FK to `games.game_id` (CASCADE on delete) |
| scrape_date | DATE | NO | Date of the scrape that produced these metrics |
| p_losing | DECIMAL(10,8) | YES | Probability of losing at time of snapshot |
| p_breaking_even | DECIMAL(10,8) | YES | Probability of breaking even at time of snapshot |
| p_winning_cash | DECIMAL(10,8) | YES | Probability of winning cash at time of snapshot |
| mo_0 | DECIMAL(10,8) | YES | Marginal odds of net profit >= $0 |
| mo_10 | DECIMAL(10,8) | YES | Marginal odds of prize >= $10 |
| mo_50 | DECIMAL(10,8) | YES | Marginal odds of prize >= $50 |
| mo_100 | DECIMAL(10,8) | YES | Marginal odds of prize >= $100 |
| mo_500 | DECIMAL(10,8) | YES | Marginal odds of prize >= $500 |
| mo_1000 | DECIMAL(10,8) | YES | Marginal odds of prize >= $1,000 |
| mo_5000 | DECIMAL(10,8) | YES | Marginal odds of prize >= $5,000 |
| mo_10000 | DECIMAL(10,8) | YES | Marginal odds of prize >= $10,000 |
| mo_50000 | DECIMAL(10,8) | YES | Marginal odds of prize >= $50,000 |
| mo_100000 | DECIMAL(10,8) | YES | Marginal odds of prize >= $100,000 |
| reward_raw | DECIMAL(12,4) | YES | Average profit per winning ticket at time of snapshot |
| risk_raw | DECIMAL(12,4) | YES | Average loss per losing ticket at time of snapshot |
| roi | DECIMAL(12,6) | YES | ROI at time of snapshot |
| value_score | DECIMAL(5,2) | YES | State-normalized value score at time of snapshot |
| depletion_high | DECIMAL(5,2) | YES | Percentage of $500+ prizes remaining at time of snapshot |
| depletion_mid | DECIMAL(5,2) | YES | Percentage of $50-$499 prizes remaining at time of snapshot |
| depletion_low | DECIMAL(5,2) | YES | Percentage of under-$50 prizes remaining at time of snapshot |
| computed_at | TIMESTAMPTZ | NO | When these metrics were computed (copied from game_metrics) |
| created_at | TIMESTAMPTZ | NO | Row insertion time |
