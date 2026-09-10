// Pure discount math for backlog B-1 (promo codes + BFAM Coins at
// checkout). No DB access — the service layer (checkoutService.ts) loads
// the promo code row and player's coin balance, then hands the numbers
// here so the arithmetic itself is unit-testable in isolation.

// MVP conversion rate: 1 BFAM Coin = ₹1 of discount. No product decision
// existed for this — documented here as the concrete default so it's easy
// to find and tune later.
export const COIN_VALUE_IN_RUPEES = 1;

export interface PromoCodeRule {
  discount_type: 'PERCENTAGE' | 'FLAT';
  discount_value: number;
  max_discount_amount: number | null;
}

// Computes a promo code's discount for a given amount, before any coin
// redemption is layered on top. Never exceeds the amount itself (a coupon
// can't make the price negative).
export function computePromoDiscount(amountDue: number, rule: PromoCodeRule): number {
  const raw =
    rule.discount_type === 'FLAT' ? rule.discount_value : (amountDue * rule.discount_value) / 100;
  const capped = rule.max_discount_amount != null ? Math.min(raw, rule.max_discount_amount) : raw;
  return Math.max(0, Math.min(capped, amountDue));
}

// Coins are applied after the promo discount, against whatever remains —
// so a player can stack both, but never past ₹0 due. Returns the coins
// actually spent (which may be fewer than requested, if that's more than
// what's left to pay) and the resulting rupee discount.
export function computeCoinRedemption(
  remainingAfterPromo: number,
  coinsRequested: number,
  coinBalance: number,
): { coinsSpent: number; discount: number } {
  const affordable = Math.min(coinsRequested, coinBalance);
  const maxUsefulCoins = Math.floor(remainingAfterPromo / COIN_VALUE_IN_RUPEES);
  const coinsSpent = Math.max(0, Math.min(affordable, maxUsefulCoins));
  return { coinsSpent, discount: coinsSpent * COIN_VALUE_IN_RUPEES };
}
