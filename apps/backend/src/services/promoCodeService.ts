import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

export interface CreatePromoCodeInput {
  code: string;
  discount_type: 'PERCENTAGE' | 'FLAT';
  discount_value: number;
  max_discount_amount?: number | null;
  min_booking_amount?: number;
  usage_limit_total?: number | null;
  usage_limit_per_player?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
}

// Promo code creation is ADMIN-only for now (backlog B-1) — there's no
// admin CMS yet (that's backlog B-6's job), so this is a plain endpoint
// rather than a management UI; codes can be created via the API directly
// until B-6 gives Admin Web a real surface for it.
export async function createPromoCode(actorUserId: string, input: CreatePromoCodeInput) {
  const promoCodeId = randomUUID();
  await sequelize.getQueryInterface().bulkInsert('promo_codes', [
    {
      promo_code_id: promoCodeId,
      code: input.code.toUpperCase(),
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      max_discount_amount: input.max_discount_amount ?? null,
      min_booking_amount: input.min_booking_amount ?? 0,
      usage_limit_total: input.usage_limit_total ?? null,
      usage_limit_per_player: input.usage_limit_per_player ?? 1,
      valid_from: input.valid_from ? new Date(input.valid_from) : null,
      valid_until: input.valid_until ? new Date(input.valid_until) : null,
      is_active: true,
      created_by: actorUserId,
      created_at: new Date(),
    },
  ]);
  return { promo_code_id: promoCodeId, code: input.code.toUpperCase() };
}

export interface PromoCodeListRow {
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
  created_at: Date;
}

export async function listPromoCodes(): Promise<PromoCodeListRow[]> {
  return sequelize.query<PromoCodeListRow>('SELECT * FROM promo_codes ORDER BY created_at DESC', {
    type: QueryTypes.SELECT,
  });
}
