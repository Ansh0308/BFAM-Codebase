import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RootTabs } from './RootTabs';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/tokens';

export function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const bootstrapDevAuth = useAuthStore((s) => s.bootstrapDevAuth);

  useEffect(() => {
    if (!token) bootstrapDevAuth();
  }, [token, bootstrapDevAuth]);

  if (!token || isBootstrapping) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator
          size="large"
          color={colors.brandRed}
          testID="app-auth-bootstrap-loading"
        />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootTabs />
    </NavigationContainer>
  );
}
