import React from 'react';
import { Stack } from 'expo-router';

// Module 2.5 — Teams. Reached from the Teams tab in the bottom nav.
export default function TeamsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0D0D0D',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: 'Create Team' }} />
      <Stack.Screen name="open" options={{ title: 'Open Teams' }} />
      <Stack.Screen name="[teamId]/index" options={{ title: 'Team Details' }} />
      <Stack.Screen name="[teamId]/manage" options={{ title: 'Manage Team' }} />
      <Stack.Screen name="create-match-stub" options={{ title: 'Create Match' }} />
    </Stack>
  );
}
