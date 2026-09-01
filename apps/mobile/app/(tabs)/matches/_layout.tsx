import React from 'react';
import { Stack } from 'expo-router';

// Module 2.6 — Match Creation & Game Room. Reached from the Matches tab in
// the bottom nav, or from a booking's confirmation screen once it's paid.
export default function MatchesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0D0D0D',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: 'Create Match' }} />
      <Stack.Screen name="[matchId]/index" options={{ title: 'Game Room' }} />
      <Stack.Screen name="[matchId]/invite" options={{ title: 'Invite Players' }} />
      <Stack.Screen name="[matchId]/check-in" options={{ title: 'Check In' }} />
      <Stack.Screen
        name="[matchId]/intro"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen name="[matchId]/live-stub" options={{ headerShown: false }} />
    </Stack>
  );
}
