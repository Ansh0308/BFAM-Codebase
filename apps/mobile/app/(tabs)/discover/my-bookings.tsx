import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Booking } from '@bfam/shared-types';
import { apiClient } from '../../../src/lib/apiClient';
import { colors } from '../../../src/theme/tokens';
import { StatusBadge, type StatusVariant } from '../../../src/components/StatusBadge';
import { SegmentedTabs } from '../../../src/components/SegmentedTabs';

type BookingScope = 'upcoming' | 'past';

const STATUS_META: Record<string, { label: string; variant: StatusVariant }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  CONFIRMED: { label: 'Confirmed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  COMPLETED: { label: 'Completed', variant: 'neutral' },
};

export default function MyBookingsScreen() {
  const router = useRouter();
  const [scope, setScope] = useState<BookingScope>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((forScope: BookingScope) => {
    setLoading(true);
    apiClient
      .getMyBookings(forScope)
      .then((res) => setBookings(res.results))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(scope);
    }, [load, scope]),
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.brandRed} testID="my-bookings-loading" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-alt px-6" edges={['bottom']}>
      <View testID="my-bookings-screen" className="flex-1 pt-4">
        {/* Backlog A-15: split into Upcoming/Past instead of one long,
            undifferentiated list of every booking ever made. */}
        <SegmentedTabs
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
          value={scope}
          onChange={setScope}
          testIDPrefix="my-bookings-scope"
        />

        {bookings.length === 0 ? (
          <Text className="text-text-secondary text-body text-center mt-6">
            {scope === 'upcoming' ? 'No upcoming bookings.' : 'No past bookings yet.'}
          </Text>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.booking_id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(tabs)/discover/booking/${item.booking_id}`)}
                className="bg-surface rounded-md border border-border-subtle p-4 mb-3"
                testID={`booking-row-${item.booking_id}`}
              >
                <Text className="font-ui font-bold text-text-primary text-button" numberOfLines={1}>
                  {item.turf_name ?? 'Turf'}
                </Text>
                <Text className="text-text-secondary text-body mt-1">
                  {item.booking_date} · {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}
                </Text>
                <View className="mt-2">
                  <StatusBadge
                    label={STATUS_META[item.booking_status]?.label ?? item.booking_status}
                    variant={STATUS_META[item.booking_status]?.variant ?? 'neutral'}
                    testID={`booking-status-${item.booking_id}`}
                  />
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
