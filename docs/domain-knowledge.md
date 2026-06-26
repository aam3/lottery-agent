# Domain Knowledge

Foundational lottery concepts, metric definitions, and decision-making context for the ScratchSmart platform.

---

## Fundamental Lottery Concepts

How scratch-off lottery games work at a structural level.

### What is a scratcher?

A scratcher (scratch-off) is a physical lottery ticket where prizes are revealed by scratching. Each scratcher is a "game" with a name, game number, price, and a set of prize tiers. Game number is the unique identifier per state.

### Fixed prize pools

Each scratcher game is printed with a fixed number of tickets and a fixed prize structure. As tickets are sold, prizes are claimed. The total prize structure (amounts and count per tier) is set at game launch and never changes. Only remaining counts change over time.

### Prize tiers

A prize tier is a specific prize value within a game (e.g., $1, $5, $100, $1,000,000). Each tier has a total number of tickets printed (some states might now have this available) and a count of prizes remaining. Losing tickets are also a tier.

### Prizes remaining

The count of unclaimed prizes for a given tier. This is the primary data point that changes over time and drives all analysis. It reflects the actual current state of the game for a buyer today.

### Overall game odds

The general odds of winning any prize on a given scratcher (e.g., "1 in 3.45"). This is game-level, not prize-tier-specific. Provided by the lottery commission or estimated from remaining ticket data. Primary use is estimating the number of losing tickets remaining.

### Prize odds

The odds of winning a specific prize tier (e.g., "1 in 1,000" for the $100 tier) *when the game was launched* (usually matches current probably but not always). Not always published by every state.

### Price point

Scratcher tickets come in fixed denominations (e.g. $1, $2, $3, $5, $10, $20, $25, $30, $50). Players typically have a budget and want the best option within a given price.

### Game editions

Lottery commissions release multiple print runs of the same game under identical names (e.g., two separate "$250,000 Crossword" games with different game numbers). Game number is the true unique identifier.

### Game lifecycle

Games end when the prize pool is sufficiently depleted or a set end date is reached. Ended games are no longer sold at retailers but prizes may remain claimable for a period.

### Prize data is public

All remaining prize information is published by state lottery commissions. Our project aggregates and presents it. Data accuracy is bounded by source accuracy and update frequency.

### Data varies by state

Different state lottery sites publish different fields. Some states don't publish per-tier totals, per-tier odds, or total tickets printed. The platform must handle missing optional fields gracefully rather than requiring uniform data across states.

---

## Metrics and What They Mean

Derived metrics that quantify a game's value. All metrics use net value (prize_value - price_tier) as the basis for categorization, meaning the cost of the ticket is always factored in.

### Net value

`prize_value - price_tier`. The profit or loss from a single ticket. A $10 prize on a $5 ticket has net value +$5 (winning). A free ticket has net value $0 (breaking even). A losing ticket has net value equal to the negative ticket price.

### Win/loss probabilities

The probability distribution across three outcomes based on net value:
- **p_losing**: Probability of losing (net value < 0). Includes losing tickets.
- **p_breaking_even**: Probability of breaking even (net value = 0). Includes free tickets, since their prize value equals the ticket price.
- **p_winning_cash**: Probability of winning cash (net value > 0).

These three probabilities sum to 1.0. They are based on current prizes remaining, not original totals, so they reflect actual current odds for a buyer today. They are mutable -- they change as prizes get claimed.

### Marginal odds

The probability of winning at least a given net value threshold. Calculated at thresholds: $0, $10, $50, $100, $500, $1,000, $5,000, $10,000, $50,000, $100,000. This lets users compare across games in a way that counters misleading top-prize fixation -- a player can see the realistic probability at each prize threshold rather than being drawn to a headline jackpot number.

### Prize depletion

A measure of how much of a game's original prize supply has been claimed, broken into bands (high, mid, low dollar amounts). Indicates whether a game's prize pool is healthily stocked or picked over.

### Risk and reward

- **Reward**: The average net gain per winning ticket.
- **Risk**: The average net loss per losing ticket.

Together they express how much you stand to gain vs. lose on a given game.

### ROI

Return on investment: `(reward - risk) / price_tier`. Expresses net expected outcome per dollar spent. Negative means net loss.

### Value score

ROI normalized to 0-100 across all active games in the same state. Provides a relative ranking so users can quickly compare games within a state without interpreting raw ROI numbers.

---

## Decision-Making Context

How players think about scratchers and how ScratchSmart helps them make better decisions.

### Price and odds relationship

In general, higher-priced games have better overall odds than lower-priced games. A $10 ticket typically gives you a better chance of winning than a $2 ticket. This is not intuitive to most players. Someone might see a $2 game advertising a $1 million top prize and assume it's a great deal, not realizing that their odds of winning that prize are astronomically lower than the odds of hitting the top prize on a $10 or $20 game. The top prize on a cheaper game is a marketing hook, not a realistic outcome. One of the most common and valuable questions a player can ask is: "What are my best odds given what I'm willing to spend?" -- and answering that requires comparing games within a price point using net value, not just looking at headline prize amounts.

### The top-prize trap

A common player misconception is to fixate on whether top prizes remain. Lottery commissions exploit this by advertising large remaining jackpots with extremely low odds. A $2 game with a $1 million top prize sounds exciting, but the odds of hitting it may be 1 in 3 million, while a $5 game's $100,000 top prize might be 1 in 500,000 -- far better odds for a far more realistic payout. We aim to contextualize top prizes within the full odds picture so users make informed comparisons rather than chasing headlines.

### Budget-driven choices

Players typically start with a price point ("I want to spend $5") and then choose among games at that price. The primary decision is which game at a given price offers the best value, not which price point to play.

### High probability doesn't mean best value

The probability of winning any cash can be highest for a game, but that doesn't mean it's the best value. A $50 game might have the highest probability of winning any prize above $0, but you're paying $50 for that chance. The value score accounts for this by weighing risk against reward -- it tells you whether what you stand to gain justifies what you're paying, not just whether you're likely to win something.

### What "best" means varies by player

Some players want the highest chance of winning anything (even small prizes). Others want the best shot at a large payout and accept lower overall odds. Marginal odds at different thresholds serve both types -- a conservative player focuses on mo_0 (any win), while a risk-tolerant player focuses on mo_500 or mo_1000.

### Cross-game comparison

Comparing raw odds across games at different price points is misleading without adjusting for ticket cost. Net value (prize minus cost) is the common denominator that makes comparisons meaningful. A $20 prize on a $10 ticket and a $10 prize on a $1 ticket look very different through the lens of net value.

---

## Calculation Edge Cases

State-specific quirks and special cases that affect how metrics are computed.

### Free tickets are break-even

Free ticket prizes have a prize_value equal to the game's ticket price, so their net value is $0. They belong in p_breaking_even, not in a separate category.

### OH ENTRY TICKET tiers are losing, not free

Ohio Cash Explosion games have "ENTRY TICKET" as a prize tier -- entry into a TV game show drawing with no guaranteed prize. These are treated as prize_value = 0 (losing), not as free tickets.

### Ohio has no total_tickets per tier

The Ohio lottery site only publishes remaining counts, not original printed totals. Prize depletion bands are NULL for Ohio games.

### NULL prize_value exclusion

Prize tiers with unknown prize values (NULL) are excluded from probability and marginal odds denominators. This ensures probability sums equal 1.0.

### Probabilities are mutable

Because probabilities use current prizes_remaining (not original total_tickets), they change with every data update. They represent the odds for a buyer right now, not at game launch.
