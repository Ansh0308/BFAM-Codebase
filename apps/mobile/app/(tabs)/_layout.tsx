import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';

const TAB_ICONS: Record<string, string> = {
  index: '⌂',
  discover: '⌕',
  matches: '▤',
  teams: '☰',
  profile: '☺',
};

const TAB_LABELS: Record<string, string> = {
  index: 'Home',
  discover: 'Discover',
  matches: 'Matches',
  teams: 'Teams',
  profile: 'Profile',
};

// Bottom tab bar exactly per Design §3.2/§4.5: Home, Discover, Matches,
// Teams, Profile — red active state, ink-black/gray inactive. This is the
// module 2.3 hand-off point from app/session-active.tsx.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#D80000',
        tabBarInactiveTintColor: '#0D0D0D',
        tabBarLabelStyle: { fontFamily: 'Inter', fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#EEEDEE' },
        tabBarLabel: TAB_LABELS[route.name] ?? route.name,
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 18 }}>{TAB_ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="matches" />
      <Tabs.Screen name="teams" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
