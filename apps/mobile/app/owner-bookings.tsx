import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OwnerBooking } from '@bfam/shared-types';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

// Today's Bookings (module 2.12, PRD §8.3/§9.2) — every booking, across
// every turf this owner runs, for today.
export default function OwnerBookingsScreen() {
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getOwnerTodaysBookings()
      .then((res) => setBookings(res.results))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="px-5 flex-1" testID="owner-bookings-screen">
        <ScreenHeader title="Today's Bookings" />
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            style={{ marginTop: 24 }}
            testID="owner-bookings-loading"
          />
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(b) => b.booking_id}
            testID="owner-bookings-list"
            ListEmptyComponent={
              <Text
                className="font-ui text-body text-text-tertiary mt-4"
                testID="owner-bookings-empty"
              >
                No bookings today.
              </Text>
            }
            renderItem={({ item }) => (
              <View
                className="bg-surface-alt rounded-lg p-4 mb-3"
                testID={`owner-booking-${item.booking_id}`}
              >
                <Text className="font-ui font-bold text-body text-text-primary">
                  {item.turf_name}
                </Text>
                <Text className="font-ui text-micro text-text-tertiary mt-1">
                  {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)} ·{' '}
                  {item.booking_status}
                </Text>
                <Text className="font-ui text-micro text-text-tertiary mt-0.5">
                  ₹{item.booking_amount}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
