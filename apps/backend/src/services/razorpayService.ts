import Razorpay from 'razorpay';
import { randomUUID } from 'crypto';
import { sequelize } from '../config/sequelize';

export interface RazorpayConfig {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}

export function getRazorpayConfig(): RazorpayConfig {
  return {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  };
}

export function createRazorpayClient() {
  const config = getRazorpayConfig();
  if (!config.keyId || !config.keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  });
}

export function acknowledgeRazorpayWebhook(event: unknown) {
  return {
    received: true,
    phase: 'phase1_skeleton',
    event,
  };
}

export interface RazorpayWebhookPayload {
  event: string;
  payment_id: string;
  [key: string]: unknown;
}

/**
 * Appends a raw Razorpay webhook payload to the append-only `payment_events`
 * log (BFAM_dbData_v2_compact.md "payment_events — MVP"). This is a skeleton
 * per Tech Stack Doc §7.3: it only persists the raw event, it does not yet
 * drive any payment/booking state transitions.
 *
 * `payment_id` is required because payment_events.payment_id is a required
 * FK to payments.payment_id — callers (or the gateway payload itself) must
 * supply a payment_id that already exists in `payments`.
 */
export async function persistRazorpayWebhookEvent(payload: RazorpayWebhookPayload) {
  if (!payload || typeof payload.event !== 'string' || payload.event.length === 0) {
    throw new Error('Webhook payload missing "event" field');
  }
  if (typeof payload.payment_id !== 'string' || payload.payment_id.length === 0) {
    throw new Error('Webhook payload missing "payment_id" field');
  }

  const eventId = randomUUID();
  const receivedAt = new Date();

  await sequelize.getQueryInterface().bulkInsert('payment_events', [
    {
      event_id: eventId,
      payment_id: payload.payment_id,
      event_type: payload.event,
      raw_payload: JSON.stringify(payload),
      received_at: receivedAt,
    },
  ]);

  return { event_id: eventId, received_at: receivedAt };
}
