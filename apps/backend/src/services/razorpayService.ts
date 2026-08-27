import Razorpay from 'razorpay';

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
