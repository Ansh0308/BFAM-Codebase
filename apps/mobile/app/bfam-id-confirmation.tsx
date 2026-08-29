import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { Button } from '../src/components/Button';
import { useSignupStore } from '../src/store/signupStore';

// "You are BF1042" reveal — shown exactly once, right after account
// creation returns bfam_id. Per PRD §12.59 this ID is permanent.
//
// Continue is the EXPLICIT hand-off point out of Module 2.1. Per the
// module brief, Profile Setup / Turf Discovery / any dashboard are later
// modules and out of scope here — so Continue deliberately does NOT
// navigate anywhere. Wire it to whatever the next module's entry route is
// once it exists.
export default function BfamIdConfirmation() {
  const { bfam_id } = useLocalSearchParams<{ bfam_id?: string }>();
  const reset = useSignupStore((s) => s.reset);

  function handleContinue() {
    // Signup flow state is no longer needed — clear it now that the
    // account exists and the user is authenticated (see authStore).
    reset();
    // Hand-off point: intentionally a no-op beyond clearing signup state.
    // The next module (Profile Setup / Dashboard) owns what happens after
    // this button, not this module.
  }

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center">
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
        <Button label="Continue" onPress={handleContinue} testID="bfam-id-continue" />
      </View>
    </ScreenContainer>
  );
}
