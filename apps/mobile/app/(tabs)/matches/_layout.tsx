import React from 'react';
import { Stack } from 'expo-router';
import { SCREEN_TRANSITION } from '../../../src/theme/navigation';

// Module 2.6 — Match Creation & Game Room. Reached from the Matches tab in
// the bottom nav, or from a booking's confirmation screen once it's paid.
export default function MatchesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0D0D0D',
        headerShadowVisible: false,
        animation: SCREEN_TRANSITION,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: 'Create Match' }} />
      {/* Draws its own header (back arrow + title) over the campaign artwork. */}
      <Stack.Screen name="rooms/index" options={{ headerShown: false }} />
      <Stack.Screen name="rooms/create" options={{ title: 'Create a Room' }} />
      <Stack.Screen name="rooms/[roomId]/index" options={{ title: 'Room' }} />
      <Stack.Screen name="[matchId]/index" options={{ title: 'Game Room' }} />
      <Stack.Screen name="[matchId]/invite" options={{ title: 'Invite Players' }} />
      <Stack.Screen name="[matchId]/check-in" options={{ title: 'Check In' }} />
      <Stack.Screen name="[matchId]/roster-check-in" options={{ headerShown: false }} />
      <Stack.Screen
        name="[matchId]/intro"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen name="[matchId]/setup" options={{ headerShown: false }} />
      <Stack.Screen name="[matchId]/live" options={{ headerShown: false }} />
      <Stack.Screen name="[matchId]/scoring" options={{ headerShown: false }} />
      <Stack.Screen name="[matchId]/scorecard" options={{ title: 'Scorecard' }} />
      <Stack.Screen name="[matchId]/result" options={{ headerShown: false }} />
    </Stack>
  );
}
