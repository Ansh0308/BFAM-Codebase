import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import {
  COIN_VALUE_IN_RUPEES,
  computeCoinRedemption,
  computePromoDiscount,
} from '../domain/checkout';
import { getCoinBalance, spendCoins } from './coinsService';
import {
  InvalidPaymentStateError,
  ObligationNotFoundError,
  PlayerProfileNotFoundError,
  PromoCodeNotApplicableError,
  PromoCodeNotFoundError,
} from '../domain/errors';

interface ObligationRow {
  obligation_id: string;
  booking_id: string;
  player_id: string | null;
  amount_due: string;
  due_status: string;
}

interface PromoCodeRow {
  promo_code_id: string;
  code: string;
  discount_type: 'PERCENTAGE' | 'FLAT';
  discount_value: string;
  max_discount_amount: string | null;
  min_booking_amount: string;
  usage_limit_total: number | null;
  usage_limit_per_player: number | null;
  valid_from: Date | null;
  valid_until: Date | null;
  is_active: boolean;
}

async function fetchObligation(obligationId: string): Promise<ObligationRow | null> {
  const [row] = await sequelize.query<ObligationRow>(
    'SELECT * FROM payment_obligations WHERE obligation_id = :obligationId',
    { type: QueryTypes.SELECT, replacements: { obligationId } },
  );
  return row ?? null;
}

async function resolvePlayerId(userId: string): Promise<string> {
  const [player] = await sequelize.query<{ player_id: string }>(
    'SELECT player_id FROM players WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  if (!player) throw new PlayerProfileNotFoundError();
  return player.player_id;
}

async function validatePromoCode(
  code: string,
  playerId: string,
  amountDue: number,
): Promise<PromoCodeRow> {
  const [promo] = await sequelize.query<PromoCodeRow>(
    'SELECT * FROM promo_codes WHERE code = :code',
    { type: QueryTypes.SELECT, replacements: { code: code.toUpperCase() } },
  );
  if (!promo || !promo.is_active) throw new PromoCodeNotFoundError();

  const now = new Date();
  if (promo.valid_from && now < new Date(promo.valid_from)) {
    throw new PromoCodeNotApplicableError('This promo code is not active yet.');
  }
  if (promo.valid_until && now > new Date(promo.valid_until)) {
    throw new PromoCodeNotApplicableError('This promo code has expired.');
  }
  if (amountDue < Number(promo.min_booking_amount)) {
    throw new PromoCodeNotApplicableError(
      `This code requires a minimum amount of ₹${promo.min_booking_amount}.`,
    );
  }

  if (promo.usage_limit_total != null) {
    const [{ count }] = await sequelize.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM promo_code_redemptions WHERE promo_code_id = :id',
      { type: QueryTypes.SELECT, replacements: { id: promo.promo_code_id } },
    );
    if (Number(count) >= promo.usage_limit_total) {
      throw new PromoCodeNotApplicableError('This promo code has reached its usage limit.');
    }
  }
  if (promo.usage_limit_per_player != null) {
    const [{ count }] = await sequelize.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM promo_code_redemptions WHERE promo_code_id = :id AND player_id = :playerId',
      { type: QueryTypes.SELECT, replacements: { id: promo.promo_code_id, playerId } },
    );
    if (Number(count) >= promo.usage_limit_per_player) {
      throw new PromoCodeNotApplicableError("You've already used this promo code.");
    }
  }

  return promo;
}

export interface ApplyCheckoutDiscountInput {
  promoCode?: string;
  coinsToRedeem?: number;
}

export interface ApplyCheckoutDiscountResult {
  obligation_id: string;
  original_amount_due: number;
  promo_discount: number;
  coins_spent: number;
  coin_discount: number;
  new_amount_due: number;
  coin_balance: number;
}

// Applies a promo code and/or a BFAM Coins redemption to a pending payment
// obligation (backlog B-1) — reduces payment_obligations.amount_due
// directly, so the existing checkout flow (initiateGatewayPayment /
// recordCashPayment, both unmodified) simply reads the already-discounted
// amount. Deliberately floors the resulting amount at ₹1 rather than
// letting a discount fully zero it out — the payment gateway's own order
// creation doesn't support a ₹0 amount, and a "coins/promo covered the
// entire booking" settlement path (skipping payment collection entirely)
// is a bigger product/PAID-state decision left for a follow-up rather than
// silently invented here.
export async function applyCheckoutDiscount(
  obligationId: string,
  actorUserId: string,
  input: ApplyCheckoutDiscountInput,
): Promise<ApplyCheckoutDiscountResult> {
  const playerId = await resolvePlayerId(actorUserId);
  const obligation = await fetchObligation(obligationId);
  if (!obligation) throw new ObligationNotFoundError(obligationId);
  if (obligation.due_status === 'PAID') {
    throw new InvalidPaymentStateError('This obligation has already been paid.');
  }

  const amountDue = Number(obligation.amount_due);
  let promoDiscount = 0;
  let promo: PromoCodeRow | null = null;
  if (input.promoCode) {
    promo = await validatePromoCode(input.promoCode, playerId, amountDue);
    promoDiscount = computePromoDiscount(amountDue, {
      discount_type: promo.discount_type,
      discount_value: Number(promo.discount_value),
      max_discount_amount:
        promo.max_discount_amount != null ? Number(promo.max_discount_amount) : null,
    });
  }

  const remainingAfterPromo = amountDue - promoDiscount;
  let coinsSpent = 0;
  let coinDiscount = 0;
  if (input.coinsToRedeem && input.coinsToRedeem > 0) {
    const coinBalance = await getCoinBalance(playerId);
    ({ coinsSpent, discount: coinDiscount } = computeCoinRedemption(
      remainingAfterPromo,
      input.coinsToRedeem,
      coinBalance,
    ));
  }

  // The ₹1 floor described above — if the combined discount would reduce
  // amount_due below it, trim the coin portion first (coins are simple to
  // request again; a promo code redemption may be limited-use, so
  // preserving it in full is the friendlier default), and only trim the
  // promo discount itself in the rare case that alone already reaches the
  // floor.
  let newAmountDue = amountDue - promoDiscount - coinDiscount;
  let actualCoinDiscount = coinDiscount;
  let actualCoinsSpent = coinsSpent;
  if (newAmountDue < 1) {
    const coinReduction = Math.min(1 - newAmountDue, actualCoinDiscount);
    actualCoinDiscount -= coinReduction;
    actualCoinsSpent = Math.floor(actualCoinDiscount / COIN_VALUE_IN_RUPEES);
    newAmountDue += coinReduction;
  }
  if (newAmountDue < 1) {
    promoDiscount -= 1 - newAmountDue;
    newAmountDue = 1;
  }

  let resultingCoinBalance = await getCoinBalance(playerId);

  await sequelize.transaction(async (transaction) => {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'payment_obligations',
        { amount_due: newAmountDue, updated_at: new Date() },
        { obligation_id: obligationId },
        { transaction },
      );

    if (promo && promoDiscount > 0) {
      await sequelize.getQueryInterface().bulkInsert(
        'promo_code_redemptions',
        [
          {
            redemption_id: randomUUID(),
            promo_code_id: promo.promo_code_id,
            player_id: playerId,
            obligation_id: obligationId,
            discount_amount: promoDiscount,
            redeemed_at: new Date(),
          },
        ],
        { transaction },
      );
    }

    if (actualCoinsSpent > 0) {
      resultingCoinBalance = await spendCoins(
        playerId,
        actualCoinsSpent,
        'BOOKING_REDEMPTION',
        { type: 'payment_obligation', id: obligationId },
        transaction,
      );
    }
  });

  return {
    obligation_id: obligationId,
    original_amount_due: amountDue,
    promo_discount: promoDiscount,
    coins_spent: actualCoinsSpent,
    coin_discount: actualCoinDiscount,
    new_amount_due: newAmountDue,
    coin_balance: resultingCoinBalance,
  };
}
