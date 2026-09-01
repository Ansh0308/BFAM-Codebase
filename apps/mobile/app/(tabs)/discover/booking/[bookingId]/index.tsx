import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Booking } from '@bfam/shared-types';
import { apiClient } from '../../../../../src/lib/apiClient';
import { colors } from '../../../../../src/theme/tokens';
import { Button } from '../../../../../src/components/Button';

export default function BookingDetailsScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getBookingDetails(bookingId)
      .then(setBooking)
      .finally(() => setLoading(false));
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading || !booking) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.brandRed} testID="booking-details-loading" />
      </SafeAreaView>
    );
  }

  const canCancel = booking.booking_status === 'PENDING' || booking.booking_status === 'CONFIRMED';

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <ScrollView className="px-6 pt-6" testID="booking-details-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black">
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
          <View className="mt-6 mb-8">
            <Button
              label="Cancel Booking"
              variant="ghost"
              onPress={() => router.push(`/(tabs)/discover/booking/${bookingId}/cancel`)}
              testID="cancel-booking-link"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
