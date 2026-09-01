import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Booking } from '@bfam/shared-types';
import { apiClient } from '../../../src/lib/apiClient';
import { colors } from '../../../src/theme/tokens';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'text-text-secondary',
  CONFIRMED: 'text-brand-red',
  CANCELLED: 'text-text-tertiary',
  COMPLETED: 'text-text-secondary',
};

export default function MyBookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getMyBookings('all')
      .then((res) => setBookings(res.results))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
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
        {bookings.length === 0 ? (
          <Text className="text-text-secondary text-body text-center mt-6">
            You have no bookings yet.
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
                <Text
                  className={`text-micro uppercase mt-2 ${STATUS_STYLES[item.booking_status] ?? 'text-text-secondary'}`}
                >
                  {item.booking_status}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
