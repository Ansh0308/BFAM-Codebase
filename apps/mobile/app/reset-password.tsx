import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';

export default function ResetPassword() {
  const router = useRouter();
  const { reset_token } = useLocalSearchParams<{ reset_token?: string }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!reset_token) {
      setError('Reset session expired. Please start over.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await apiClient.resetPassword(reset_token, password);
      setSuccess(true);
      setTimeout(() => router.replace('/login'), 1200);
    } catch {
      setError('Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <View className="mt-10 mb-8">
        <Text className="font-display text-title-xl uppercase text-ink-black">New Password</Text>
      </View>

      {success ? (
        <Text className="font-ui text-body text-text-primary">
          Password reset successfully. Redirecting to Log In&hellip;
        </Text>
      ) : (
        <>
          <TextField
            label="New Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="reset-password-new"
          />
          <TextField
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            testID="reset-password-confirm"
          />

          {error ? (
            <Text className="font-ui text-body text-brand-red-dark mb-4">{error}</Text>
          ) : null}

          <Button
            label="Reset Password"
            onPress={handleSubmit}
            loading={loading}
            testID="reset-password-submit"
          />
        </>
      )}
    </ScreenContainer>
  );
}
