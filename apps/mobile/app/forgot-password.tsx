import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';

export default function ForgotPassword() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!identifier) {
      setError('Enter your phone or email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Backend always returns the same generic response whether or not the
      // identifier maps to an account (no enumeration) — so this always
      // proceeds to the OTP screen regardless. `sent=1` tells
      // otp-verification the OTP has already been dispatched, so it won't
      // send a second one.
      const response = await apiClient.forgotPassword(identifier);
      router.push({
        pathname: '/otp-verification',
        params: {
          identifier,
          purpose: 'RESET_PASSWORD',
          sent: '1',
          devOtp: response.dev_otp ?? '',
        },
      });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <View className="mt-10 mb-8">
        <Text className="font-display text-title-xl uppercase text-ink-black">Forgot Password</Text>
        <Text className="font-ui text-body text-text-secondary mt-2">
          We&apos;ll send a code to reset your password.
        </Text>
      </View>

      <TextField
        label="Phone or Email"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        testID="forgot-password-identifier"
      />

      {error ? <Text className="font-ui text-body text-brand-red-dark mb-4">{error}</Text> : null}

      <Button
        label="Send Code"
        onPress={handleSubmit}
        loading={loading}
        testID="forgot-password-submit"
      />
    </ScreenContainer>
  );
}
