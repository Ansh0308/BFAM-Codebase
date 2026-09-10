// Unit tests for backlog B-1's pure discount math (domain/checkout.ts).

import { computeCoinRedemption, computePromoDiscount } from '../domain/checkout';

describe('computePromoDiscount', () => {
  it('a FLAT discount is applied as-is, up to the amount due', () => {
    expect(
      computePromoDiscount(1000, {
        discount_type: 'FLAT',
        discount_value: 200,
        max_discount_amount: null,
      }),
    ).toBe(200);
  });

  it('a FLAT discount never exceeds the amount due', () => {
    expect(
      computePromoDiscount(150, {
        discount_type: 'FLAT',
        discount_value: 200,
        max_discount_amount: null,
      }),
    ).toBe(150);
  });

  it('a PERCENTAGE discount is computed off the amount due', () => {
    expect(
      computePromoDiscount(1000, {
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        max_discount_amount: null,
      }),
    ).toBe(100);
  });

  it('a PERCENTAGE discount is capped by max_discount_amount when set', () => {
    expect(
      computePromoDiscount(10000, {
        discount_type: 'PERCENTAGE',
        discount_value: 50,
        max_discount_amount: 300,
      }),
    ).toBe(300);
  });

  it('never returns a negative discount', () => {
    expect(
      computePromoDiscount(0, {
        discount_type: 'FLAT',
        discount_value: 200,
        max_discount_amount: null,
      }),
    ).toBe(0);
  });
});

describe('computeCoinRedemption', () => {
  it('spends exactly the requested coins when affordable and useful', () => {
    expect(computeCoinRedemption(1000, 200, 500)).toEqual({ coinsSpent: 200, discount: 200 });
  });

  it("caps at the player's coin balance", () => {
    expect(computeCoinRedemption(1000, 500, 120)).toEqual({ coinsSpent: 120, discount: 120 });
  });

  it("caps at what is left to pay — coins can't push the total below zero", () => {
    expect(computeCoinRedemption(50, 200, 500)).toEqual({ coinsSpent: 50, discount: 50 });
  });

  it('spending zero coins requested spends zero, regardless of balance', () => {
    expect(computeCoinRedemption(1000, 0, 500)).toEqual({ coinsSpent: 0, discount: 0 });
  });

  it('nothing left to pay (already fully covered by a promo code) redeems zero coins', () => {
    expect(computeCoinRedemption(0, 100, 500)).toEqual({ coinsSpent: 0, discount: 0 });
  });
});
