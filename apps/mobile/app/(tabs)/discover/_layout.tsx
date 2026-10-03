import React from 'react';
import { Stack } from 'expo-router';
import { SCREEN_TRANSITION } from '../../../src/theme/navigation';
import { stackBackButton } from '../../../src/components/BackButton';

// A back arrow that still works after a refresh or when the page is opened directly.
const HeaderBack = stackBackButton('/(tabs)/discover');

// Module 2.3 — Turf Discovery & Booking. Reached from the Discover tab and
// from Home's "Book Turf" quick action.
export default function DiscoverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0D0D0D',
        headerShadowVisible: false,
        animation: SCREEN_TRANSITION,
        headerLeft: HeaderBack,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="turf/[turfId]/index" options={{ title: 'Turf Details' }} />
      <Stack.Screen name="turf/[turfId]/availability" options={{ title: 'Availability' }} />
      <Stack.Screen
        name="booking/[bookingId]/confirmation"
        options={{
          title: 'Booking Confirmed',
          headerBackVisible: false,
          headerLeft: () => null,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="booking/[bookingId]/payment" options={{ title: 'Payment' }} />
      <Stack.Screen name="my-bookings" options={{ title: 'My Bookings' }} />
      <Stack.Screen name="booking/[bookingId]/index" options={{ title: 'Booking Details' }} />
      <Stack.Screen name="booking/[bookingId]/cancel" options={{ title: 'Cancel Booking' }} />
      <Stack.Screen name="payment-history" options={{ title: 'Payment History' }} />
      <Stack.Screen
        name="booking/[bookingId]/reschedule"
        options={{ title: 'Reschedule Booking' }}
      />
      <Stack.Screen name="venue/[venueId]" options={{ title: 'Venue' }} />
    </Stack>
  );
}
