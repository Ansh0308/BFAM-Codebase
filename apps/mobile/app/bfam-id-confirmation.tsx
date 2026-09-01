import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AuthScreenBackground } from '../src/components/AuthScreenBackground';
import { Button } from '../src/components/Button';
import { useSignupStore } from '../src/store/signupStore';

// "You are BF1042" reveal — shown exactly once, right after account
// creation returns bfam_id. Per PRD §12.59 this ID is permanent.
//
// Continue now hands off into Module 2.2 (Profile Setup) — Module 2.1's
// brief kept this a deliberate dead end since Profile Setup didn't exist
// yet; it does now.
export default function BfamIdConfirmation() {
  const router = useRouter();
  const { bfam_id } = useLocalSearchParams<{ bfam_id?: string }>();
  const reset = useSignupStore((s) => s.reset);

  function handleContinue() {
    // Signup flow state is no longer needed — clear it now that the
    // account exists and the user is authenticated (see authStore).
    reset();
    router.replace('/profile-setup');
  }

  return (
    <AuthScreenBackground>
      <View className="flex-1 items-center justify-center">
        <View
          className="rounded-full bg-surface-alt items-center justify-center mb-4"
          style={{ width: 64, height: 64 }}
        >
          <Feather name="check" size={28} color="#D80000" />
        </View>
        <Text className="font-ui text-micro uppercase tracking-wide text-text-tertiary mb-2">
          Your BFAM ID
        </Text>
        <Text className="font-display text-hero text-brand-red" testID="bfam-id-value">
          {bfam_id ?? '—'}
        </Text>
        <Text className="font-ui text-body text-text-secondary text-center mt-6 px-5">
          This ID is permanent and stays with you across every match, turf, and team on BFAM.
        </Text>
      </View>

      <View className="mb-8">
        <Button
          label="Continue"
          onPress={handleContinue}
          testID="bfam-id-continue"
          iconRight={<Feather name="arrow-right" size={18} color="#FFFFFF" />}
        />
      </View>
    </AuthScreenBackground>
  );
}
