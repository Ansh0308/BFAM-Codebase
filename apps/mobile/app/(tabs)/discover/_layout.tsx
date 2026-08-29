import React from 'react';
import { Stack } from 'expo-router';

// Module 2.3 — Turf Discovery & Booking. Reached from the Discover tab and
// from Home's "Book Turf" quick action.
export default function DiscoverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0D0D0D',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="turf/[turfId]/index" options={{ title: 'Turf Details' }} />
      <Stack.Screen name="turf/[turfId]/availability" options={{ title: 'Availability' }} />
      <Stack.Screen
        name="booking/[bookingId]/confirmation"
        options={{ title: 'Booking Confirmed', headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen name="booking/[bookingId]/payment" options={{ title: 'Payment' }} />
      <Stack.Screen name="my-bookings" options={{ title: 'My Bookings' }} />
      <Stack.Screen name="booking/[bookingId]/index" options={{ title: 'Booking Details' }} />
      <Stack.Screen name="booking/[bookingId]/cancel" options={{ title: 'Cancel Booking' }} />
    </Stack>
  );
}
