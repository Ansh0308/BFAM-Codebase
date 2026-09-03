import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { OwnerDashboard } from '../../src/screens/OwnerDashboard';
import { StaffDashboard } from '../../src/screens/StaffDashboard';

// Home tab — role router (module 2.12, PRD §8.3/§8.4): the Player
// experience here is still a placeholder (a later module), but
// TURF_OWNER/TURF_STAFF now land on their real Owner/Staff Dashboard,
// same mobile app, role-gated per PRD §9's "Turf Owner and Turf Staff get
// that same mobile app... plus a responsive web dashboard".
export default function Home() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);

  if (role === 'TURF_OWNER') return <OwnerDashboard />;
  if (role === 'TURF_STAFF') return <StaffDashboard />;

  return (
    <ScreenContainer>
      <View className="pt-6">
        <Text className="font-ui font-bold text-title-xl text-ink-black">Home</Text>
        <Text className="font-ui text-body text-text-secondary mt-2">
          The full Home screen is built in a later module.
        </Text>

        <View className="mt-8">
          <Button
            label="Book Turf"
            onPress={() => router.push('/(tabs)/discover')}
            testID="home-book-turf-quick-action"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
