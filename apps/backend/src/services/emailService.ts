import nodemailer, { Transporter } from 'nodemailer';

// Email delivery via Brevo's SMTP relay (Module 2.2 — email verification,
// product request 2026-08-30). Used only for the "verify an email you're
// adding to your profile" OTP flow — nothing else in this codebase sends
// email yet.
function isConfigured(): boolean {
  return Boolean(process.env.BREVO_SMTP_LOGIN && process.env.BREVO_SMTP_KEY);
}

let cachedTransporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.BREVO_SMTP_PORT || 587),
      secure: false, // STARTTLS on port 587, not implicit TLS.
      auth: {
        user: process.env.BREVO_SMTP_LOGIN,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });
  }
  return cachedTransporter;
}

/**
 * Renders the OTP email body — inline styles + a table-based layout, since
 * most email clients (Gmail, Outlook especially) strip <style> blocks and
 * don't support modern CSS. Matches the app's brand system (Design §7:
 * brand-red #D80000, ink-black, bold display type) as closely as email
 * rendering allows — no custom @font-face (unsupported almost everywhere),
 * so a bold system-font stack stands in for the in-app Archivo Black/Anton
 * display face.
 */
function renderOtpEmailHtml(code: string): string {
  const digits = code.split('');
  const digitCells = digits
    .map(
      (digit) => `
        <td style="padding: 0 4px;">
          <div style="
            width: 40px;
            height: 48px;
            line-height: 48px;
            text-align: center;
            background-color: #FBEAEA;
            border: 1px solid #F3C9C9;
            border-radius: 8px;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 24px;
            font-weight: 700;
            color: #D80000;
          ">${digit}</div>
        </td>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 0; background-color: #F4F2EF;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F4F2EF; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(13,13,13,0.08);">
            <tr>
              <td style="background-color: #0D0D0D; padding: 28px 32px;">
                <span style="font-family: Arial Black, Arial, sans-serif; font-size: 22px; font-weight: 900; letter-spacing: 1px; color: #FFFFFF;">BFAM</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 36px 32px 8px;">
                <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #D80000;">Verify your email</p>
                <p style="margin: 10px 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #3C362D;">
                  Enter this code in BFAM to confirm your email address. It expires in 5 minutes.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>${digitCells}</tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 36px;">
                <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #767676;">
                  Didn't request this? You can safely ignore this email — your account is still secure.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 18px 32px; background-color: #FAF9F7; border-top: 1px solid #EEEDEE;">
                <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #A39D8F;">
                  BFAM &middot; Play. Compete. Repeat.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Sends an email-verification OTP. Falls back to a console-only mock when
 * Brevo isn't configured, but only outside production — same convention as
 * smsService.ts's OTP delivery.
 *
 * Returns the failure reason (if any) so callers can surface it — outside
 * production only, e.g. alongside `dev_otp` — instead of the caller having
 * to go dig through server console output to find out why a "real" send
 * silently didn't go out.
 */
export async function sendEmailVerificationOtp(
  email: string,
  code: string,
): Promise<{ deliveryError: string | null }> {
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Email delivery is not configured on this server (BREVO_SMTP_LOGIN/BREVO_SMTP_KEY missing)',
      );
    }
    console.log(`[MOCK EMAIL] ${email}: your BFAM email verification code is ${code}`);
    return {
      deliveryError:
        'Email delivery not configured (BREVO_SMTP_LOGIN/BREVO_SMTP_KEY missing) — mocked.',
    };
  }

  // BREVO_SENDER_EMAIL must be a sender verified in the Brevo account — the
  // SMTP login itself is just the auth username, not necessarily a
  // deliverable "from" address.
  const from = process.env.BREVO_SENDER_EMAIL || (process.env.BREVO_SMTP_LOGIN as string);

  try {
    await getTransporter().sendMail({
      from: `BFAM <${from}>`,
      to: email,
      subject: 'Verify your email — BFAM',
      text: `Your BFAM email verification code is ${code}. It expires in 5 minutes.`,
      html: renderOtpEmailHtml(code),
    });
    return { deliveryError: null };
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    // Credentials are configured but the real send still failed — most
    // commonly Brevo's IP-allowlist rejecting an unrecognized sending IP,
    // or BREVO_SENDER_EMAIL not being a verified sender (both Brevo account
    // settings, not something fixable in code). Don't let that block local/
    // dev testing: fall back to the console-only mock, same as the "not
    // configured at all" branch above — but tell the caller why.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[emailService] Real send failed (${message}); falling back to console mock.`);
    console.log(`[MOCK EMAIL] ${email}: your BFAM email verification code is ${code}`);
    return { deliveryError: message };
  }
}
