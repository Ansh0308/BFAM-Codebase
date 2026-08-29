import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { Booking } from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { colors } from '../../theme/tokens';
import type { DiscoverStackParamList } from '../../navigation/types';

type Props = StackScreenProps<DiscoverStackParamList, 'MyBookings'>;

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'text-text-secondary',
  CONFIRMED: 'text-brand-red',
  CANCELLED: 'text-text-tertiary',
  COMPLETED: 'text-text-secondary',
};

export function MyBookingsScreen({ navigation }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getMyBookings('all')
      .then((res) => setBookings(res.results))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  if (loading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color={colors.brandRed} testID="my-bookings-loading" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-alt px-6 pt-6" testID="my-bookings-screen">
      <Text className="font-display text-title-xl text-ink-black uppercase mb-4">My Bookings</Text>

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
              onPress={() => navigation.navigate('BookingDetails', { bookingId: item.booking_id })}
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
  );
}
