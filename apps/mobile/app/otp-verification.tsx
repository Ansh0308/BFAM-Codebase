import React, { useEffect, useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AuthScreenBackground } from '../src/components/AuthScreenBackground';
import { TextField } from '../src/components/TextField';
import { OtpInput } from '../src/components/OtpInput';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import { useSignupStore } from '../src/store/signupStore';
import { AuthSuccessResponse } from '@bfam/shared-types';

type Purpose = 'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD';

const RESEND_COOLDOWN_SECONDS = 30;

// Handles OTP entry for all three purposes (SIGNUP / LOGIN / RESET_PASSWORD)
// via the `purpose` route param. `identifier` may arrive pre-filled (e.g.
// from Signup or Forgot Password) or be collected here (e.g. the Login
// screen's "Log in with OTP instead" path).
export default function OtpVerification() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    identifier?: string;
    purpose?: Purpose;
    sent?: string;
    devOtp?: string;
  }>();
  const purpose = (params.purpose ?? 'LOGIN') as Purpose;

  const setSession = useAuthStore((s) => s.setSession);
  const setSignupToken = useSignupStore((s) => s.setSignupToken);
  const setSignupIdentifier = useSignupStore((s) => s.setIdentifier);
  const storedIdentifier = useSignupStore((s) => s.identifier);

  const alreadySent = params.sent === '1';
  const [identifier, setIdentifier] = useState(params.identifier ?? storedIdentifier ?? '');
  const [otpSent, setOtpSent] = useState(Boolean(params.identifier));
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(params.devOtp || null);
  const [cooldown, setCooldown] = useState(alreadySent ? RESEND_COOLDOWN_SECONDS : 0);

  const sendOtp = useCallback(async () => {
    if (!identifier) {
      setError('Enter your phone or email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await apiClient.sendOtp(identifier, purpose);
      setOtpSent(true);
      setDevOtp(response.dev_otp ?? null);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError('Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [identifier, purpose]);

  useEffect(() => {
    // Only auto-send when the caller hasn't already dispatched one (e.g.
    // Forgot Password already called POST /auth/forgot-password before
    // navigating here with sent=1) — otherwise every identifier-prefilled
    // arrival (Signup) triggers the send itself.
    if (params.identifier && !alreadySent) {
      sendOtp();
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify() {
    if (code.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await apiClient.verifyOtp(identifier, code, purpose);

      if (purpose === 'SIGNUP' && 'signup_token' in result) {
        setSignupIdentifier(identifier);
        setSignupToken(result.signup_token);
        router.push('/role-selection');
        return;
      }

      if (purpose === 'RESET_PASSWORD' && 'reset_token' in result) {
        router.push({ pathname: '/reset-password', params: { reset_token: result.reset_token } });
        return;
      }

      if (purpose === 'LOGIN' && 'token' in result) {
        const auth = result as AuthSuccessResponse;
        await setSession(auth.token, {
          user_id: auth.user_id,
          bfam_id: auth.bfam_id,
          role: auth.role,
        });
        router.replace('/session-active');
        return;
      }

      setError('Unexpected response. Please try again.');
    } catch {
      setError('That code is invalid or expired.');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenBackground scroll>
      <View className="items-center mt-12 mb-6">
        <Text className="font-display text-title-xl text-brand-red">BFAM</Text>
      </View>

      <View className="flex-row items-center justify-center mb-6">
        <View className="h-px w-8 bg-brand-red" />
        <View className="mx-3">
          <Feather name="shield" size={22} color="#D80000" />
        </View>
        <View className="h-px w-8 bg-brand-red" />
      </View>

      <View className="items-center mb-8">
        <Text className="font-display text-title-xl uppercase text-ink-black">Verify</Text>
        {otpSent ? (
          <Text className="font-ui text-body text-text-secondary mt-2 text-center">
            Enter the 6-digit code sent to{' '}
            <Text className="font-ui font-bold text-brand-red">{identifier}</Text>
          </Text>
        ) : (
          <Text className="font-ui text-body text-text-secondary mt-2 text-center">
            Enter your phone or email to receive a code
          </Text>
        )}
      </View>

      {!otpSent ? (
        <>
          <TextField
            label="Phone or Email"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            testID="otp-identifier"
            iconLeft={<Feather name="smartphone" size={18} color="#D80000" />}
          />
          <Button
            label="Send Code"
            onPress={sendOtp}
            loading={loading}
            testID="otp-send"
            iconRight={<Feather name="arrow-right" size={18} color="#FFFFFF" />}
          />
        </>
      ) : (
        <>
          <OtpInput value={code} onChange={setCode} error={Boolean(error)} testID="otp-input" />

          {devOtp ? (
            <View className="flex-row items-center mt-4">
              <Feather name="lock" size={14} color="#D80000" />
              <Text className="font-ui text-micro text-text-secondary ml-2">
                Dev OTP: <Text className="font-bold text-ink-black">{devOtp}</Text>
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text className="font-ui text-body text-brand-red-dark mt-3">{error}</Text>
          ) : null}

          <View className="mt-6">
            <Button
              label="Verify"
              onPress={handleVerify}
              loading={loading}
              testID="otp-verify"
              iconRight={<Feather name="arrow-right" size={18} color="#FFFFFF" />}
            />
          </View>

          <View className="mt-4 items-center">
            <Text
              className="font-ui text-body text-text-secondary"
              onPress={cooldown > 0 ? undefined : sendOtp}
              testID="otp-resend"
            >
              {cooldown > 0 ? (
                <>
                  Resend code in <Text className="text-brand-red font-bold">{cooldown}s</Text>
                </>
              ) : (
                <Text className="text-brand-red font-bold">Resend code</Text>
              )}
            </Text>
          </View>
        </>
      )}
    </AuthScreenBackground>
  );
}
