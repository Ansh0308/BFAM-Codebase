import { isLocalDevOrTest } from './env';

// How one-time passwords are produced and delivered.
//
//   OTP_MODE=provider (default)  A random code is generated and SENT through
//                                the real channel (MSG91 SMS; Brevo for email).
//                                In a real deployment the code is never
//                                returned in the API response.
//   OTP_MODE=static              BETA ONLY. Every OTP is the fixed code below;
//                                nothing is sent, and the API returns it (as
//                                `dev_otp`, which the app already displays) so
//                                testers can finish sign-up with no SMS
//                                provider. Anyone who knows the code can verify
//                                ANY phone number and reset ANY account's
//                                password, so use it only on an invite-only beta
//                                — see "Replacing the static OTP" in
//                                BFAM_Deployment_Plan.md.
//
//   STATIC_OTP_CODE=123456       the fixed code (exactly 6 digits)
export type OtpMode = 'provider' | 'static';

export const DEFAULT_STATIC_OTP_CODE = '123456';

export function getOtpMode(env: NodeJS.ProcessEnv = process.env): OtpMode {
  return (env.OTP_MODE ?? '').trim().toLowerCase() === 'static' ? 'static' : 'provider';
}

export function getStaticOtpCode(env: NodeJS.ProcessEnv = process.env): string {
  const code = (env.STATIC_OTP_CODE ?? '').trim() || DEFAULT_STATIC_OTP_CODE;
  if (!/^\d{6}$/.test(code)) {
    throw new Error('STATIC_OTP_CODE must be exactly 6 digits');
  }
  return code;
}

// Whether an OTP may be echoed back in the API response (`dev_otp`): always on
// a developer's machine, and in static beta mode — never on a real deployment
// that sends codes through a provider.
export function shouldExposeOtpInResponse(env: NodeJS.ProcessEnv = process.env): boolean {
  return isLocalDevOrTest() || getOtpMode(env) === 'static';
}
