import React from 'react';
import { Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';

// A back chevron that always has somewhere to go. router.back() does nothing when
// the page was opened directly or refreshed on the web (there is no history), which
// is why many screens appeared to have no way back. `fallback` is where to go then.
export function BackButton({
  fallback = '/(tabs)',
  color = '#0D0D0D',
  testID = 'back-button',
}: {
  fallback?: Href;
  color?: string;
  testID?: string;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      testID={testID}
      style={{ paddingVertical: 8, paddingRight: 8, alignSelf: 'flex-start' }}
    >
      <Feather name="chevron-left" size={26} color={color} />
    </Pressable>
  );
}

// For a Stack's screenOptions.headerLeft: the same button in the navigation header.
export function stackBackButton(fallback: Href) {
  return function HeaderBack() {
    return <BackButton fallback={fallback} testID="header-back" />;
  };
}
