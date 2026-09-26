// Beta shortcut: OTP_MODE=static uses one fixed code and sends nothing, so
// testers can sign up before an SMS provider (MSG91 + India DLT approval) is
// live. It must be explicit opt-in, and real-provider delivery stays the
// default and never leaks the code in a real deployment.

interface OtpRow {
  identifier: string;
  purpose: string;
  code_hash: string;
  expires_at: Date;
  consumed_at: Date | null;
  otp_id: string;
}
let otpRows: OtpRow[] = [];

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      if (sql.startsWith('DELETE FROM otp_codes')) {
        otpRows = otpRows.filter(
          (x) => !(x.identifier === r.identifier && x.purpose === r.purpose),
        );
        return [{}];
      }
      if (sql.startsWith('INSERT INTO otp_codes')) {
        otpRows.push({
          otp_id: r.otpId as string,
          identifier: r.identifier as string,
          purpose: r.purpose as string,
          code_hash: r.codeHash as string,
          expires_at: r.expiresAt as Date,
          consumed_at: null,
        });
        return [{}];
      }
      if (sql.includes('SELECT otp_id, code_hash')) {
        return otpRows.filter(
          (x) => x.identifier === r.identifier && x.purpose === r.purpose && !x.consumed_at,
        );
      }
      if (sql.startsWith('UPDATE otp_codes SET consumed_at')) {
        const row = otpRows.find((x) => x.otp_id === r.otpId);
        if (row) row.consumed_at = r.now as Date;
        return [{}];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

const mockSendSms = jest.fn();
const mockSendEmail = jest.fn();
jest.mock('../services/smsService', () => ({
  sendOtpSms: (...args: unknown[]) => mockSendSms(...args),
}));
jest.mock('../services/emailService', () => ({
  sendEmailVerificationOtp: (...args: unknown[]) => mockSendEmail(...args),
}));

import { getOtpMode, getStaticOtpCode, shouldExposeOtpInResponse } from '../config/otpMode';
import { generateAndSendOtp, verifyAndConsumeOtp } from '../services/otpService';

const ORIGINAL = {
  NODE_ENV: process.env.NODE_ENV,
  OTP_MODE: process.env.OTP_MODE,
  STATIC_OTP_CODE: process.env.STATIC_OTP_CODE,
};
beforeEach(() => {
  otpRows = [];
  mockSendSms.mockResolvedValue(undefined);
  mockSendEmail.mockResolvedValue({ deliveryError: null });
  delete process.env.OTP_MODE;
  delete process.env.STATIC_OTP_CODE;
  process.env.NODE_ENV = 'test';
});
afterEach(() => {
  for (const [k, v] of Object.entries(ORIGINAL)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('otpMode helpers', () => {
  it('defaults to real-provider delivery; only an explicit "static" opts in', () => {
    expect(getOtpMode({})).toBe('provider');
    expect(getOtpMode({ OTP_MODE: 'provider' })).toBe('provider');
    expect(getOtpMode({ OTP_MODE: 'anything-else' })).toBe('provider');
    expect(getOtpMode({ OTP_MODE: 'static' })).toBe('static');
    expect(getOtpMode({ OTP_MODE: ' STATIC ' })).toBe('static');
  });

  it('uses 123456 unless STATIC_OTP_CODE says otherwise, and insists on 6 digits', () => {
    expect(getStaticOtpCode({})).toBe('123456');
    expect(getStaticOtpCode({ STATIC_OTP_CODE: '482913' })).toBe('482913');
    expect(() => getStaticOtpCode({ STATIC_OTP_CODE: '1234' })).toThrow(/6 digits/);
    expect(() => getStaticOtpCode({ STATIC_OTP_CODE: 'abcdef' })).toThrow(/6 digits/);
  });

  it('exposes the code in responses only locally or in static beta mode', () => {
    process.env.NODE_ENV = 'development';
    expect(shouldExposeOtpInResponse({})).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(shouldExposeOtpInResponse({})).toBe(false);
    expect(shouldExposeOtpInResponse({ OTP_MODE: 'provider' })).toBe(false);
    expect(shouldExposeOtpInResponse({ OTP_MODE: 'static' })).toBe(true);
    process.env.NODE_ENV = 'staging';
    expect(shouldExposeOtpInResponse({})).toBe(false);
  });
});

describe('generateAndSendOtp', () => {
  it('provider mode (default): random code, delivered by SMS, verifiable', async () => {
    const { code } = await generateAndSendOtp('+919999900001', 'SIGNUP');
    expect(code).toMatch(/^\d{6}$/);
    expect(mockSendSms).toHaveBeenCalledWith('+919999900001', code, 'SIGNUP');
    expect(await verifyAndConsumeOtp('+919999900001', 'SIGNUP', code)).toBe('VALID');
  });

  it('static mode: the fixed code, nothing sent, and only that code verifies', async () => {
    process.env.OTP_MODE = 'static';
    const { code, deliveryError } = await generateAndSendOtp('+919999900002', 'SIGNUP');
    expect(code).toBe('123456');
    expect(deliveryError).toBeNull();
    expect(mockSendSms).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();

    expect(await verifyAndConsumeOtp('+919999900002', 'SIGNUP', '000000')).toBe('INVALID');
    expect(await verifyAndConsumeOtp('+919999900002', 'SIGNUP', '123456')).toBe('VALID');
    // Still single-use.
    expect(await verifyAndConsumeOtp('+919999900002', 'SIGNUP', '123456')).toBe('NOT_FOUND');
  });

  it('static mode also covers the email-verification purpose (no Brevo needed in beta)', async () => {
    process.env.OTP_MODE = 'static';
    process.env.STATIC_OTP_CODE = '482913';
    const { code } = await generateAndSendOtp('tester@example.com', 'EMAIL_VERIFY');
    expect(code).toBe('482913');
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(await verifyAndConsumeOtp('tester@example.com', 'EMAIL_VERIFY', '482913')).toBe('VALID');
  });
});
