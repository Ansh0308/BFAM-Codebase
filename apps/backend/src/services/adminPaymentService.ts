import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Admin Web — Payment & refund oversight (AW-7, PRD §9.1): every payment on the
// platform (UPI, gateway, cash; turf bookings and tournament entry fees) with
// who paid, what it was for and any refund against it, plus the refunds
// themselves. Read-only: refunds are issued by the existing booking flows.

export class PaymentOversightError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'PaymentOversightError';
  }
}

const MAX_DAYS = 366;
const DAY_MS = 86_400_000;

function assertRange(from: string, to: string) {
  const days =
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS;
  if (Number.isNaN(days) || days < 0) {
    throw new PaymentOversightError('The end date must be on or after the start date.', 400);
  }
  if (days > MAX_DAYS)
    throw new PaymentOversightError(`Choose a range of at most ${MAX_DAYS} days.`, 400);
}

export interface PaymentFilters {
  from: string;
  to: string;
  status?: string;
  method?: string;
  kind?: 'BOOKING' | 'TOURNAMENT_ENTRY';
  search?: string;
}

export interface AdminPaymentRow {
  payment_id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  kind: 'BOOKING' | 'TOURNAMENT_ENTRY';
  reference: string | null;
  payer_phone: string;
  payer_name: string | null;
  collected_by_phone: string | null;
  context: string | null;
  refunded: number;
  initiated_at: Date;
  completed_at: Date | null;
}

export interface PaymentSummary {
  collected: number;
  pending: number;
  failed: number;
  refunded: number;
  count: number;
  by_method: { method: string; payments: number; amount: number }[];
}

function where(filters: PaymentFilters) {
  const clauses = ['DATE(p.initiated_at) BETWEEN :from AND :to'];
  const replacements: Record<string, unknown> = { from: filters.from, to: filters.to };
  if (filters.status) {
    clauses.push('p.payment_status = :status');
    replacements.status = filters.status;
  }
  if (filters.method) {
    clauses.push('p.payment_method = :method');
    replacements.method = filters.method;
  }
  if (filters.kind === 'TOURNAMENT_ENTRY') {
    clauses.push('EXISTS (SELECT 1 FROM tournament_teams e WHERE e.payment_id = p.payment_id)');
  } else if (filters.kind === 'BOOKING') {
    clauses.push('NOT EXISTS (SELECT 1 FROM tournament_teams e WHERE e.payment_id = p.payment_id)');
  }
  if (filters.search?.trim()) {
    clauses.push(
      '(u.phone_number LIKE :search OR pl.full_name LIKE :search OR p.payment_id LIKE :search OR p.gateway_payment_id LIKE :search OR p.cash_reference LIKE :search)',
    );
    replacements.search = `%${filters.search.trim()}%`;
  }
  return { sql: clauses.join(' AND '), replacements };
}

const FROM = `FROM payments p
  JOIN users u ON u.user_id = p.payer_id
  LEFT JOIN players pl ON pl.user_id = u.user_id
  LEFT JOIN users cu ON cu.user_id = p.collected_by`;

export async function listPayments(filters: PaymentFilters): Promise<{
  results: AdminPaymentRow[];
  summary: PaymentSummary;
}> {
  assertRange(filters.from, filters.to);
  const w = where(filters);

  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT p.payment_id, p.amount, p.payment_method, p.payment_status, p.initiated_at, p.completed_at,
            COALESCE(p.gateway_payment_id, p.cash_reference) AS reference,
            u.phone_number AS payer_phone, pl.full_name AS payer_name, cu.phone_number AS collected_by_phone,
            CASE WHEN EXISTS (SELECT 1 FROM tournament_teams e WHERE e.payment_id = p.payment_id)
                 THEN 'TOURNAMENT_ENTRY' ELSE 'BOOKING' END AS kind,
            COALESCE(
              (SELECT tn.name FROM tournament_teams e JOIN tournaments tn ON tn.tournament_id = e.tournament_id
                WHERE e.payment_id = p.payment_id LIMIT 1),
              (SELECT tf.turf_name FROM payment_allocations a
                 JOIN payment_obligations o ON o.obligation_id = a.obligation_id
                 JOIN bookings b ON b.booking_id = o.booking_id
                 JOIN turfs tf ON tf.turf_id = b.turf_id
                WHERE a.payment_id = p.payment_id LIMIT 1)
            ) AS context,
            COALESCE((SELECT SUM(r.refund_amount) FROM refunds r
                       WHERE r.payment_id = p.payment_id AND r.refund_status = 'COMPLETED'), 0) AS refunded
     ${FROM}
     WHERE ${w.sql}
     ORDER BY p.initiated_at DESC LIMIT 500`,
    { type: QueryTypes.SELECT, replacements: w.replacements },
  );

  const totals = await sequelize.query<{
    payment_status: string;
    payment_method: string;
    n: number | string;
    total: number | string | null;
  }>(
    `SELECT p.payment_status, p.payment_method, COUNT(*) AS n, SUM(p.amount) AS total
     ${FROM}
     WHERE ${w.sql}
     GROUP BY p.payment_status, p.payment_method`,
    { type: QueryTypes.SELECT, replacements: w.replacements },
  );
  const [refunds] = await sequelize.query<{ total: number | string | null }>(
    `SELECT SUM(r.refund_amount) AS total FROM refunds r
     WHERE r.refund_status = 'COMPLETED' AND DATE(r.created_at) BETWEEN :from AND :to`,
    { type: QueryTypes.SELECT, replacements: { from: filters.from, to: filters.to } },
  );

  const sum = (status: string) =>
    totals.filter((t) => t.payment_status === status).reduce((a, t) => a + Number(t.total ?? 0), 0);
  const methods = new Map<string, { payments: number; amount: number }>();
  for (const t of totals) {
    const cur = methods.get(t.payment_method) ?? { payments: 0, amount: 0 };
    cur.payments += Number(t.n);
    if (t.payment_status === 'SUCCESS') cur.amount += Number(t.total ?? 0);
    methods.set(t.payment_method, cur);
  }

  return {
    results: rows.map((r) => ({
      ...(r as unknown as AdminPaymentRow),
      amount: Number(r.amount),
      refunded: Number(r.refunded ?? 0),
    })),
    summary: {
      collected: sum('SUCCESS'),
      pending: sum('PENDING'),
      failed: sum('FAILED'),
      refunded: Number(refunds?.total ?? 0),
      count: totals.reduce((a, t) => a + Number(t.n), 0),
      by_method: [...methods.entries()]
        .map(([method, v]) => ({ method, ...v }))
        .sort((a, b) => b.amount - a.amount),
    },
  };
}

export interface AdminRefundRow {
  refund_id: string;
  payment_id: string;
  refund_amount: number;
  reason: string;
  refund_status: string;
  gateway_refund_id: string | null;
  payment_amount: number;
  payment_method: string;
  payer_phone: string;
  payer_name: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export async function listRefunds(
  from: string,
  to: string,
  status?: string,
): Promise<AdminRefundRow[]> {
  assertRange(from, to);
  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT r.refund_id, r.payment_id, r.refund_amount, r.reason, r.refund_status, r.gateway_refund_id,
            r.created_at, r.completed_at, p.amount AS payment_amount, p.payment_method,
            u.phone_number AS payer_phone, pl.full_name AS payer_name
     FROM refunds r
     JOIN payments p ON p.payment_id = r.payment_id
     JOIN users u ON u.user_id = p.payer_id
     LEFT JOIN players pl ON pl.user_id = u.user_id
     WHERE DATE(r.created_at) BETWEEN :from AND :to ${status ? 'AND r.refund_status = :status' : ''}
     ORDER BY r.created_at DESC LIMIT 500`,
    { type: QueryTypes.SELECT, replacements: { from, to, ...(status ? { status } : {}) } },
  );
  return rows.map((r) => ({
    ...(r as unknown as AdminRefundRow),
    refund_amount: Number(r.refund_amount),
    payment_amount: Number(r.payment_amount),
  }));
}
