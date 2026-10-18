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
  replaceWith,
}: {
  fallback?: Href;
  color?: string;
  testID?: string;
  // Always go here instead of back one step (for a screen whose "previous" screen must not be
  // returned to, e.g. the result of a finished match must not lead back into scoring).
  replaceWith?: Href;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        if (replaceWith) router.replace(replaceWith);
        else if (router.canGoBack()) router.back();
        else router.replace(fallback);
      }}
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
