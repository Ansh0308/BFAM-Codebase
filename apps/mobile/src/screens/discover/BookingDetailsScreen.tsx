import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { Booking } from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { colors } from '../../theme/tokens';
import type { DiscoverStackParamList } from '../../navigation/types';

type Props = StackScreenProps<DiscoverStackParamList, 'BookingDetails'>;

export function BookingDetailsScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getBookingDetails(bookingId)
      .then(setBooking)
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  if (loading || !booking) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color={colors.brandRed} testID="booking-details-loading" />
      </View>
    );
  }

  const canCancel = booking.booking_status === 'PENDING' || booking.booking_status === 'CONFIRMED';

  return (
    <ScrollView className="flex-1 bg-surface px-6 pt-6" testID="booking-details-screen">
      <Text className="font-display text-title-xl text-ink-black uppercase">
        {booking.turf_name ?? 'Booking'}
      </Text>
      <Text className="text-text-secondary text-body mt-1">{booking.city}</Text>

      <View className="bg-surface-alt rounded-md p-4 mt-5">
        <Text className="text-text-secondary text-micro uppercase">Date</Text>
        <Text className="text-text-primary text-button mb-3">{booking.booking_date}</Text>
        <Text className="text-text-secondary text-micro uppercase">Time</Text>
        <Text className="text-text-primary text-button mb-3">
          {booking.start_time.slice(0, 5)} – {booking.end_time.slice(0, 5)}
        </Text>
        <Text className="text-text-secondary text-micro uppercase">Amount</Text>
        <Text className="text-text-primary text-button mb-3">₹{booking.booking_amount}</Text>
        <Text className="text-text-secondary text-micro uppercase">Payment Mode</Text>
        <Text className="text-text-primary text-button mb-3">{booking.payment_mode}</Text>
        <Text className="text-text-secondary text-micro uppercase">Status</Text>
        <Text className="text-brand-red text-button uppercase">{booking.booking_status}</Text>
      </View>

      {booking.booking_status === 'CANCELLED' && booking.cancellation_reason && (
        <View className="mt-4">
          <Text className="text-text-secondary text-micro uppercase">Cancellation Reason</Text>
          <Text className="text-text-primary text-body mt-1">{booking.cancellation_reason}</Text>
        </View>
      )}

      {canCancel && (
        <Pressable
          onPress={() => navigation.navigate('CancelBooking', { bookingId })}
          className="border border-brand-red rounded-md py-4 items-center mt-6 mb-8"
          testID="cancel-booking-link"
        >
          <Text className="font-ui font-bold text-brand-red text-button uppercase">
            Cancel Booking
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
