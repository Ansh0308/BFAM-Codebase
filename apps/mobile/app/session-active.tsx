import React from 'react';
import { View, Text } from 'react-native';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { useAuthStore } from '../src/store/authStore';

// Placeholder hand-off screen reached by: (a) password/OTP login, (b)
// existing-user Google/Apple login, (c) an already-valid session found on
// launch (see app/index.tsx). Building the real destination (Dashboard) is
// explicitly out of scope for Module 2.1 — this is a deliberate dead end,
// not a stub of the next module.
export default function SessionActive() {
  const user = useAuthStore((s) => s.user);

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center">
        <Text className="font-display text-title-xl uppercase text-ink-black">You&apos;re In</Text>
        {user ? (
          <Text className="font-ui text-body text-text-secondary mt-2">{user.bfam_id}</Text>
        ) : null}
        <Text className="font-ui text-body text-text-tertiary text-center mt-6 px-5">
          Module 2.1 hand-off point — Dashboard is a later module.
        </Text>
      </View>
    </ScreenContainer>
  );
}
