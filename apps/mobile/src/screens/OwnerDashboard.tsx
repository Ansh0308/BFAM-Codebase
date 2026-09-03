import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Turf } from '@bfam/shared-types';
import { apiClient } from '../lib/apiClient';
import { colors } from '../theme/tokens';

// Owner Dashboard (module 2.12, PRD §8.3 "Owner Dashboard": business
// overview). Hub for every other Owner Mobile screen this module builds —
// Turf Management/Pricing/Availability/Sound Settings live under each
// turf card; Today's Bookings/Match Management/Staff Management/Payments
// are dashboard-level quick links.
export function OwnerDashboard() {
  const router = useRouter();
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getMyTurfs()
      .then((res) => setTurfs(res.results))
      .catch(() => setTurfs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-5" testID="owner-dashboard-screen">
        <View className="flex-row items-center justify-between pt-4 mb-2">
          <Text className="font-ui font-bold text-title-xl text-ink-black">Owner Dashboard</Text>
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            accessibilityLabel="Notifications"
            testID="owner-notifications-button"
          >
            <Feather name="bell" size={22} color="#0D0D0D" />
          </Pressable>
        </View>

        <View className="flex-row flex-wrap mb-6" style={{ marginHorizontal: -6 }}>
          <QuickLink
            icon="calendar"
            label="Today's Bookings"
            onPress={() => router.push('/owner-bookings')}
            testID="quick-link-bookings"
          />
          <QuickLink
            icon="activity"
            label="Matches"
            onPress={() => router.push('/owner-matches')}
            testID="quick-link-matches"
          />
          <QuickLink
            icon="users"
            label="Staff"
            onPress={() => router.push('/owner-staff')}
            testID="quick-link-staff"
          />
          <QuickLink
            icon="credit-card"
            label="Payments"
            onPress={() => router.push('/owner-payments')}
            testID="quick-link-payments"
          />
        </View>

        <View className="flex-row items-center justify-between mb-2">
          <Text className="font-ui font-bold text-text-secondary text-micro uppercase">
            My Turfs ({turfs.length})
          </Text>
          <Pressable onPress={() => router.push('/owner-turfs/create')} testID="add-turf-button">
            <Text className="font-ui font-bold text-body text-brand-red">+ Add Turf</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            style={{ marginTop: 24 }}
            testID="owner-turfs-loading"
          />
        ) : turfs.length === 0 ? (
          <Text className="font-ui text-body text-text-tertiary mt-4" testID="owner-turfs-empty">
            No turfs yet — add your first one to get started.
          </Text>
        ) : (
          turfs.map((t) => (
            <Pressable
              key={t.turf_id}
              onPress={() => router.push(`/owner-turfs/${t.turf_id}`)}
              className="bg-surface-alt rounded-lg p-4 mb-3"
              testID={`turf-card-${t.turf_id}`}
            >
              <Text className="font-ui font-bold text-body text-text-primary">{t.turf_name}</Text>
              <Text className="font-ui text-micro text-text-tertiary mt-1">
                {t.city} · {t.turf_status}
              </Text>
            </Pressable>
          ))
        )}

        <View className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <View style={{ width: '50%', paddingHorizontal: 6 }} className="mb-3">
      <Pressable
        onPress={onPress}
        className="bg-surface-alt rounded-lg p-4 items-center"
        testID={testID}
      >
        <Feather name={icon} size={20} color="#D80000" />
        <Text className="font-ui font-semibold text-micro text-text-primary mt-2 text-center">
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
