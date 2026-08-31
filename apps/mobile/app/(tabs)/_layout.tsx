import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const ACTIVE = '#D80000';
const INACTIVE = '#767676';

// Fixed bottom tab bar per Design §3.2/§4.5: white bg, top border-subtle,
// active = brand-red icon + label with a small red underline indicator,
// inactive = ink-black/gray. Home/Discover/Matches/Teams are stub nav
// entries for later modules (Module 2.2 only builds Profile for real) —
// see src/components/ComingSoonScreen.tsx.
function TabIndicator({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View className="items-center" style={{ width: 32 }}>
      {children}
      <View
        className={focused ? 'bg-brand-red' : 'bg-transparent'}
        style={{ height: 2, width: 16, borderRadius: 1, marginTop: 4 }}
      />
    </View>
  );
}

function TabIcon({
  name,
  focused,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  focused: boolean;
}) {
  return (
    <TabIndicator focused={focused}>
      <Feather name={name} size={22} color={focused ? ACTIVE : INACTIVE} />
    </TabIndicator>
  );
}

function MatchesTabIcon({ focused }: { focused: boolean }) {
  return (
    <TabIndicator focused={focused}>
      <MaterialCommunityIcons name="cricket" size={22} color={focused ? ACTIVE : INACTIVE} />
    </TabIndicator>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EEEDEE',
          height: 60,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: '600',
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused }) => <TabIcon name="compass" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ focused }) => <MatchesTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: 'Teams',
          tabBarIcon: ({ focused }) => <TabIcon name="users" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
