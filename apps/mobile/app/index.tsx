import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../src/store/authStore';
import { BfamWordmark } from '../src/components/BfamWordmark';

const HAS_ONBOARDED_KEY = 'bfam_has_onboarded';

// SecureStore has no web implementation (Keychain/Keystore-backed, native
// only) — see src/store/authStore.ts for the same guard on the credential
// path. On web this always routes through onboarding since there's nowhere
// to durably remember "has onboarded" there.
async function getHasOnboarded(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(HAS_ONBOARDED_KEY);
}

// Splash: a brief brand moment, then routes based on auth/onboarding state.
// An existing valid session skips straight past Login/Signup to the module
// hand-off point (see app/bfam-id-confirmation.tsx for why that's a dead
// end here, not a dashboard) — Dashboard itself is out of this module's
// scope.
export default function Splash() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function decideRoute() {
      if (token) {
        // Already signed in — skip onboarding/login entirely.
        router.replace('/(tabs)/home');
        return;
      }

      const hasOnboarded = await getHasOnboarded();
      if (cancelled) return;

      if (hasOnboarded) {
        router.replace('/login');
      } else {
        router.replace('/onboarding');
      }
      setCheckedOnboarding(true);
    }

    // Small delay so the brand moment is actually visible.
    const timer = setTimeout(decideRoute, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router, token]);

  return (
    <View className="flex-1 bg-surface items-center justify-center">
      <BfamWordmark />
      {!checkedOnboarding ? <ActivityIndicator color="#D80000" style={{ marginTop: 24 }} /> : null}
    </View>
  );
}

export { HAS_ONBOARDED_KEY };
