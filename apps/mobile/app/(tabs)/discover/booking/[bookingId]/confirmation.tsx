import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Booking } from '@bfam/shared-types';
import { apiClient } from '../../../../../src/lib/apiClient';
import { colors } from '../../../../../src/theme/tokens';
import { Button } from '../../../../../src/components/Button';

// Booking Confirmation hands off to a payment step stub only — the real
// Payments flow is module 2.4, out of scope here.
export default function BookingConfirmationScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getBookingDetails(bookingId)
      .then((data) => {
        if (!cancelled) setBooking(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['bottom']}>
        <ActivityIndicator
          size="large"
          color={colors.brandRed}
          testID="booking-confirmation-loading"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <ScrollView className="px-6 pt-8" testID="booking-confirmation-screen">
        <View className="items-center mb-6">
          <View className="w-16 h-16 rounded-full bg-surface-alt items-center justify-center mb-4">
            <Text className="text-brand-red text-title-xl">✓</Text>
          </View>
          <Text className="font-ui font-bold text-title-xl text-ink-black text-center">
            Slot Reserved
          </Text>
          <Text className="text-text-secondary text-body text-center mt-2">
            Complete payment to confirm your booking.
          </Text>
        </View>

        {booking && (
          <View className="bg-surface-alt rounded-md p-4 mb-6">
            <Text className="text-text-secondary text-micro uppercase">Date</Text>
            <Text className="text-text-primary text-button mb-3">{booking.booking_date}</Text>
            <Text className="text-text-secondary text-micro uppercase">Time</Text>
            <Text className="text-text-primary text-button mb-3">
              {booking.start_time.slice(0, 5)} – {booking.end_time.slice(0, 5)}
            </Text>
            <Text className="text-text-secondary text-micro uppercase">Amount</Text>
            <Text className="text-text-primary text-button">₹{booking.booking_amount}</Text>
          </View>
        )}

        <View className="mb-4">
          <Button
            label="Proceed to Payment"
            onPress={() => router.push(`/(tabs)/discover/booking/${bookingId}/payment`)}
            testID="proceed-to-payment-button"
          />
        </View>

        <Button
          label="View My Bookings"
          variant="ghost"
          onPress={() => router.push('/(tabs)/discover/my-bookings')}
          testID="view-my-bookings-link"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
