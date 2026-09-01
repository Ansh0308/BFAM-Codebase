import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const TAB_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'home',
  discover: 'compass',
  matches: 'activity',
  teams: 'users',
  profile: 'user',
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
        tabBarInactiveTintColor: '#9A9A9A',
        tabBarLabelStyle: {
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EEEDEE',
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
        },
        tabBarLabel: TAB_LABELS[route.name] ?? route.name,
        tabBarIcon: ({ color, focused }) => (
          <Feather
            name={TAB_ICONS[route.name]}
            size={22}
            color={color}
            style={{ opacity: focused ? 1 : 0.85 }}
          />
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
