import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
}

// Safe-area aware wrapper used by every auth/onboarding screen: surface
// background, space-5 (24px) horizontal margin per Design §7's screen-edge
// spacing rule.
export function ScreenContainer({ children, scroll = false }: ScreenContainerProps) {
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <Wrapper className="flex-1 px-5" contentContainerStyle={scroll ? { flexGrow: 1 } : undefined}>
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}
