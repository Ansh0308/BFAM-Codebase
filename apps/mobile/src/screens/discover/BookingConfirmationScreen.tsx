import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { Booking } from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { colors } from '../../theme/tokens';
import type { DiscoverStackParamList } from '../../navigation/types';

type Props = StackScreenProps<DiscoverStackParamList, 'BookingConfirmation'>;

// Booking Confirmation hands off to a payment step stub only — the real
// Payments flow is module 2.4, out of scope here.
export function BookingConfirmationScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
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
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator
          size="large"
          color={colors.brandRed}
          testID="booking-confirmation-loading"
        />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface px-6 pt-8" testID="booking-confirmation-screen">
      <View className="items-center mb-6">
        <View className="w-16 h-16 rounded-full bg-surface-alt items-center justify-center mb-4">
          <Text className="text-brand-red text-title-xl">✓</Text>
        </View>
        <Text className="font-display text-title-xl text-ink-black uppercase text-center">
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

      <Pressable
        onPress={() => navigation.navigate('PaymentStub', { bookingId })}
        className="bg-brand-red rounded-md py-4 items-center mb-4"
        testID="proceed-to-payment-button"
      >
        <Text className="font-ui font-bold text-surface text-button uppercase">
          Proceed to Payment
        </Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('MyBookings')}
        className="items-center mb-8"
        testID="view-my-bookings-link"
      >
        <Text className="text-text-secondary text-body">View My Bookings</Text>
      </Pressable>
    </ScrollView>
  );
}
