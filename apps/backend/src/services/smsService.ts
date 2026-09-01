import axios from 'axios';

// Real OTP SMS delivery via MSG91's Flow API (India-focused; matches BFAM's
// Indian phone numbers). Requires a DLT-approved SMS template registered
// with MSG91 — see the setup walkthrough for what to register and where
// these values come from.
//
// MSG91_AUTH_KEY: the account's Auth Key (MSG91 dashboard > API > Auth Key).
// MSG91_FLOW_ID: the Flow ID for the approved OTP template (MSG91 dashboard
//   > Flows). The template must contain a variable — this code sends it as
//   `OTP` — for the code itself.
// MSG91_SENDER_ID: the 6-character DLT-approved sender ID (e.g. "BFAMSP").
function isConfigured(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_FLOW_ID);
}

// Phone numbers are stored/validated as 10-digit Indian numbers elsewhere in
// this codebase (see validation/schemas.ts) — MSG91 expects a country code
// prefix, so it's added here rather than changing the stored format.
function toMsg91MobileFormat(identifier: string): string {
  const digitsOnly = identifier.replace(/\D/g, '');
  return digitsOnly.startsWith('91') ? digitsOnly : `91${digitsOnly}`;
}

async function sendViaMsg91(phoneNumber: string, code: string): Promise<void> {
  await axios.post(
    'https://control.msg91.com/api/v5/flow/',
    {
      flow_id: process.env.MSG91_FLOW_ID,
      sender: process.env.MSG91_SENDER_ID,
      mobiles: toMsg91MobileFormat(phoneNumber),
      OTP: code,
    },
    {
      headers: {
        authkey: process.env.MSG91_AUTH_KEY as string,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    },
  );
}

/**
 * Sends an OTP code to a phone number identifier. Email identifiers (used
 * for login) are skipped — SMS-only for now, matching this project's phone-
 * first auth design; a real email gateway is a separate, not-yet-scoped
 * integration.
 *
 * Falls back to a console-only mock when MSG91 isn't configured, but only
 * outside production — a production server with no SMS provider configured
 * is a real user-facing outage, not something to silently paper over.
 */
export async function sendOtpSms(identifier: string, code: string, purpose: string): Promise<void> {
  const isEmail = identifier.includes('@');

  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SMS delivery is not configured on this server (MSG91_AUTH_KEY/MSG91_FLOW_ID missing)',
      );
    }
    console.log(`[MOCK SMS] ${identifier} (${purpose}): your BFAM code is ${code}`);
    return;
  }

  if (isEmail) {
    // No email gateway integrated yet — dev-mode identifiers only.
    console.log(
      `[MOCK SMS - email identifier, no gateway configured] ${identifier} (${purpose}): ${code}`,
    );
    return;
  }

  await sendViaMsg91(identifier, code);
}
