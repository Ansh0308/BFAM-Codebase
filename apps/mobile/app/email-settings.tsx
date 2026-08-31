import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { TextField } from '../src/components/TextField';
import { OtpInput } from '../src/components/OtpInput';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';

// Optional post-signup email (product update — no longer collected at
// signup), now proven via OTP before it's saved (product decision,
// 2026-08-30) — sent via Brevo (see backend's emailService.ts). Two steps:
// enter the address -> enter the 6-digit code sent to it. The email is
// never written to the profile until the code is verified.
export default function EmailSettings() {
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [step, setStep] = useState<'enter-email' | 'enter-otp'>('enter-email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [devEmailError, setDevEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getMyProfile()
      .then((profile) => {
        setSavedEmail(profile.email);
        setVerified(Boolean(profile.email_verified_at));
        setEmail(profile.email ?? '');
      })
      .catch(() => {
        // Nothing to prefill — leave the field empty.
      });
  }, []);

  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    try {
      const response = await apiClient.sendEmailOtp(email.trim());
      setDevOtp(response.dev_otp ?? null);
      setDevEmailError(response.dev_email_error ?? null);
      setOtp('');
      setStep('enter-otp');
    } catch {
      setError('Could not send a verification code. Check the address and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    setLoading(true);
    try {
      const profile = await apiClient.verifyEmailOtp(email.trim(), otp);
      setSavedEmail(profile.email);
      setVerified(Boolean(profile.email_verified_at));
      setStep('enter-email');
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        setError('This email is already registered to another account.');
      } else {
        setError('That code is incorrect or has expired.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-5" testID="email-settings-screen">
        <ScreenHeader title="Email" />

        <View className="flex-row items-center mt-2 mb-6" testID="email-status-row">
          <Feather
            name={verified ? 'check-circle' : 'circle'}
            size={16}
            color={verified ? '#D80000' : '#767676'}
          />
          <Text className="font-ui text-body text-text-secondary ml-2">
            {verified ? `Verified — ${savedEmail}` : 'No verified email yet'}
          </Text>
        </View>

        {step === 'enter-email' ? (
          <>
            <TextField
              label="Email Address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              testID="email-input"
            />

            {error ? (
              <Text
                className="font-ui text-body text-brand-red-dark mb-4"
                testID="email-settings-error"
              >
                {error}
              </Text>
            ) : null}

            <Button
              label="Send Verification Code"
              onPress={handleSendOtp}
              loading={loading}
              disabled={!email.trim()}
              testID="email-send-otp"
            />
          </>
        ) : (
          <>
            <Text className="font-ui text-body text-text-secondary mb-4">
              Enter the 6-digit code sent to{' '}
              <Text className="font-bold text-text-primary">{email}</Text>.
            </Text>

            {devOtp ? (
              <Text className="font-ui text-micro text-text-tertiary mb-2" testID="email-dev-otp">
                Dev OTP: {devOtp}
              </Text>
            ) : null}
            {devEmailError ? (
              <Text
                className="font-ui text-micro text-brand-red-dark mb-4"
                testID="email-dev-error"
              >
                Real email didn't send: {devEmailError}
              </Text>
            ) : null}

            <View className="mb-4">
              <OtpInput
                value={otp}
                onChange={setOtp}
                testID="email-otp-input"
                error={Boolean(error)}
              />
            </View>

            {error ? (
              <Text
                className="font-ui text-body text-brand-red-dark mb-4"
                testID="email-settings-error"
              >
                {error}
              </Text>
            ) : null}

            <Button
              label="Verify"
              onPress={handleVerifyOtp}
              loading={loading}
              disabled={otp.length !== 6}
              testID="email-verify-otp"
            />

            <Pressable
              onPress={() => {
                setStep('enter-email');
                setError(null);
              }}
              className="items-center mt-4"
              testID="email-change-address"
            >
              <Text className="font-ui text-body text-brand-red">Change email address</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
