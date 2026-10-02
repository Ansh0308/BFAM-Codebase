import React from 'react';
import { Stack } from 'expo-router';
import { SCREEN_TRANSITION } from '../../../src/theme/navigation';

// Module 2.5 — Teams. Reached from the Teams tab in the bottom nav.
//
// Pins My Teams (index) as the screen the Teams tab always opens on —
// Expo Router's documented way to fix the initial route of a stack
// explicitly, rather than leaving it implicit.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TeamsLayout() {
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
      {/* Draws its own compact header + hero, same as rooms/index. */}
      <Stack.Screen name="create" options={{ headerShown: false }} />
      {/* Draws its own compact header + hero, same as create/rooms/index. */}
      <Stack.Screen name="open" options={{ headerShown: false }} />
      <Stack.Screen name="[teamId]/index" options={{ title: 'Team Details' }} />
      <Stack.Screen name="[teamId]/manage" options={{ title: 'Manage Team' }} />
      <Stack.Screen name="create-match-stub" options={{ title: 'Create Match' }} />
    </Stack>
  );
}
