import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OwnerBooking } from '@bfam/shared-types';
import { apiClient } from '../lib/apiClient';
import { colors } from '../theme/tokens';

// Staff Dashboard (module 2.12, PRD §8.4 "Today's Bookings" +
// "Match Operations"). Surfaces the PRD §32.14 verification status up
// front — an unverified staff member can still browse, but Check-In and
// Payments will refuse them until an owner approves.
export function StaffDashboard() {
  const router = useRouter();
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getStaffTodaysBookings()
      .then((res) => setBookings(res.results))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-5" testID="staff-dashboard-screen">
        <View className="flex-row items-center justify-between pt-4 mb-2">
          <Text className="font-ui font-bold text-title-xl text-ink-black">Staff Dashboard</Text>
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            accessibilityLabel="Notifications"
            testID="staff-notifications-button"
          >
            <Feather name="bell" size={22} color="#0D0D0D" />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/staff-verification')}
          className="flex-row items-center bg-surface-alt rounded-lg p-4 mb-6"
          testID="verification-status-banner"
        >
          <Feather name="shield" size={18} color="#D80000" />
          <Text className="font-ui text-body text-text-primary ml-3 flex-1">
            Verification status — tap to submit or check your document.
          </Text>
          <Feather name="chevron-right" size={18} color="#9A9A9A" />
        </Pressable>

        <View className="flex-row flex-wrap mb-6" style={{ marginHorizontal: -6 }}>
          <QuickLink
            icon="activity"
            label="Match Operations"
            onPress={() => router.push('/staff-matches')}
            testID="quick-link-matches"
          />
        </View>

        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
          Today&apos;s Bookings ({bookings.length})
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            style={{ marginTop: 24 }}
            testID="staff-bookings-loading"
          />
        ) : bookings.length === 0 ? (
          <Text className="font-ui text-body text-text-tertiary mt-4" testID="staff-bookings-empty">
            No bookings today at your assigned turf(s).
          </Text>
        ) : (
          bookings.map((b) => (
            <View
              key={b.booking_id}
              className="bg-surface-alt rounded-lg p-4 mb-3"
              testID={`booking-row-${b.booking_id}`}
            >
              <Text className="font-ui font-bold text-body text-text-primary">{b.turf_name}</Text>
              <Text className="font-ui text-micro text-text-tertiary mt-1">
                {b.start_time.slice(0, 5)} · {b.booking_status}
              </Text>
            </View>
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
