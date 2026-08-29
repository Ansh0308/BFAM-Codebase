import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TurfListingScreen } from '../screens/discover/TurfListingScreen';
import { TurfDetailsScreen } from '../screens/discover/TurfDetailsScreen';
import { TurfAvailabilityScreen } from '../screens/discover/TurfAvailabilityScreen';
import { BookingConfirmationScreen } from '../screens/discover/BookingConfirmationScreen';
import { PaymentStubScreen } from '../screens/discover/PaymentStubScreen';
import { MyBookingsScreen } from '../screens/discover/MyBookingsScreen';
import { BookingDetailsScreen } from '../screens/discover/BookingDetailsScreen';
import { CancelBookingScreen } from '../screens/discover/CancelBookingScreen';
import type { DiscoverStackParamList } from './types';
import { colors } from '../theme/tokens';

const Stack = createStackNavigator<DiscoverStackParamList>();

// Module 2.3 — Turf Discovery & Booking. Reached from the Discover tab and
// from Home's "Book Turf" quick action.
export function DiscoverStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface, shadowOpacity: 0 },
        headerTintColor: colors.inkBlack,
        headerTitleStyle: { fontFamily: 'Inter-Bold' },
      }}
    >
      <Stack.Screen
        name="TurfListing"
        component={TurfListingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TurfDetails"
        component={TurfDetailsScreen}
        options={{ title: 'Turf Details' }}
      />
      <Stack.Screen
        name="TurfAvailability"
        component={TurfAvailabilityScreen}
        options={{ title: 'Availability' }}
      />
      <Stack.Screen
        name="BookingConfirmation"
        component={BookingConfirmationScreen}
        options={{ title: 'Booking Confirmed', headerLeft: () => null, gestureEnabled: false }}
      />
      <Stack.Screen
        name="PaymentStub"
        component={PaymentStubScreen}
        options={{ title: 'Payment' }}
      />
      <Stack.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{ title: 'My Bookings' }}
      />
      <Stack.Screen
        name="BookingDetails"
        component={BookingDetailsScreen}
        options={{ title: 'Booking Details' }}
      />
      <Stack.Screen
        name="CancelBooking"
        component={CancelBookingScreen}
        options={{ title: 'Cancel Booking' }}
      />
    </Stack.Navigator>
  );
}
