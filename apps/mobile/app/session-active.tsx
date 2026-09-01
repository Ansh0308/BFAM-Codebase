import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { Button } from '../src/components/Button';
import { useAuthStore } from '../src/store/authStore';

// Hand-off screen reached by: (a) password/OTP login, (b) existing-user
// Google/Apple login, (c) an already-valid session found on launch (see
// app/index.tsx). Module 2.1 originally left this as a dead end pending a
// "later module" — module 2.3's (tabs) group (Home/Discover/Matches/Teams/
// Profile) is that module, so this now hands off there instead.
export default function SessionActive() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center">
        <Text className="font-ui font-bold text-title-xl text-ink-black">You&apos;re In</Text>
        {user ? (
          <Text className="font-ui text-body text-text-secondary mt-2">{user.bfam_id}</Text>
        ) : null}

        <View className="mt-8 w-full">
          <Button
            label="Continue to BFAM"
            onPress={() => router.replace('/(tabs)')}
            testID="continue-to-app-button"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
