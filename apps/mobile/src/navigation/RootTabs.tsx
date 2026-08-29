import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/home/HomeScreen';
import { DiscoverStack } from './DiscoverStack';
import { PlaceholderScreen } from '../screens/stubs/PlaceholderScreen';
import type { RootTabParamList } from './types';
import { colors } from '../theme/tokens';

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, string> = {
  Home: '⌂',
  Discover: '⌕',
  Matches: '▤',
  Teams: '☰',
  Profile: '☺',
};

// Bottom tab bar exactly per Design §3.2/§4.5: Home, Discover, Matches,
// Teams, Profile — red active state, ink-black/gray inactive.
export function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.brandRed,
        tabBarInactiveTintColor: colors.inkBlack,
        tabBarLabelStyle: { fontFamily: 'Inter', fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.borderSubtle },
        headerShown: false,
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 18 }}>{TAB_ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Discover" component={DiscoverStack} />
      <Tab.Screen name="Matches">{() => <PlaceholderScreen title="Matches" />}</Tab.Screen>
      <Tab.Screen name="Teams">{() => <PlaceholderScreen title="Teams" />}</Tab.Screen>
      <Tab.Screen name="Profile">{() => <PlaceholderScreen title="Profile" />}</Tab.Screen>
    </Tab.Navigator>
  );
}
