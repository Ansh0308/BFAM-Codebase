import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { OwnerDashboard } from '../../src/screens/OwnerDashboard';
import { StaffDashboard } from '../../src/screens/StaffDashboard';
import { apiClient } from '../../src/lib/apiClient';
import { DISCOVERY_ENABLED } from '../../src/config/featureFlags';

// Home tab — role router (module 2.12, PRD §8.3/§8.4): the Player
// experience here is still a placeholder (a later module), but
// TURF_OWNER/TURF_STAFF now land on their real Owner/Staff Dashboard,
// same mobile app, role-gated per PRD §9's "Turf Owner and Turf Staff get
// that same mobile app... plus a responsive web dashboard".
export default function Home() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const [bookTurfBusy, setBookTurfBusy] = useState(false);
  const [bookTurfError, setBookTurfError] = useState<string | null>(null);

  if (role === 'TURF_OWNER') return <OwnerDashboard />;
  if (role === 'TURF_STAFF') return <StaffDashboard />;

  // Backlog A-12: Discover is temporarily hidden (see featureFlags.ts) —
  // with only one turf to offer for now, skip the listing entirely and go
  // straight to that turf's availability screen (per the backlog's own
  // resolution of "what replaces Discover meanwhile").
  async function bookTurf() {
    if (!DISCOVERY_ENABLED) {
      setBookTurfBusy(true);
      setBookTurfError(null);
      try {
        const { results } = await apiClient.getTurfs({});
        const turf = results[0];
        if (!turf) {
          setBookTurfError('No turf is available to book yet.');
          return;
        }
        router.push(
          `/(tabs)/discover/turf/${turf.turf_id}/availability?turfName=${encodeURIComponent(turf.turf_name)}`,
        );
      } catch {
        setBookTurfError('Could not load the turf. Please try again.');
      } finally {
        setBookTurfBusy(false);
      }
      return;
    }
    router.push('/(tabs)/discover');
  }

  return (
    <ScreenContainer>
      <View className="pt-6">
        <Text className="font-ui font-bold text-title-xl text-ink-black">Home</Text>
        <Text className="font-ui text-body text-text-secondary mt-2">
          The full Home screen is built in a later module.
        </Text>

        {bookTurfError && (
          <Text className="font-ui text-body text-brand-red-dark mt-4">{bookTurfError}</Text>
        )}

        <View className="mt-8">
          <Button
            label="Book Turf"
            onPress={bookTurf}
            loading={bookTurfBusy}
            testID="home-book-turf-quick-action"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
