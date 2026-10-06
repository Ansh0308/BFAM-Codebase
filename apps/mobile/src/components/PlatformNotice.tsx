import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Text } from 'react-native';
import Constants from 'expo-constants';
import type { PublicConfig } from '@bfam/shared-types';
import { apiClient } from '../lib/apiClient';
import { isOlderVersion } from '../lib/appVersion';

// Platform-wide notice (AW-12): a strip across the top while the admin has put the platform
// in maintenance, or when this install is older than the minimum version they set. Fails
// quiet — if the config can't be read, the app carries on as normal.
export function PlatformNotice() {
  const [config, setConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getPublicConfig();
        if (!cancelled) setConfig(res);
      } catch {
        // Keep the app usable without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) return null;

  const current = Constants.expoConfig?.version ?? '';
  const outdated = isOlderVersion(current, config.app.min_version);
  const maintenance = config.app.maintenance.enabled;
  if (!outdated && !maintenance) return null;

  const message = outdated
    ? `Please update BFAM to version ${config.app.min_version} or newer to keep booking.`
    : config.app.maintenance.message ||
      'BFAM is under maintenance. Bookings and payments are paused for now.';
  const help = config.support.email
    ? `mailto:${config.support.email}`
    : config.support.phone
      ? `tel:${config.support.phone}`
      : null;

  return (
    <Pressable
      onPress={() => help && Linking.openURL(help)}
      disabled={!help}
      accessibilityRole="alert"
      testID="platform-notice"
      style={{
        backgroundColor: outdated ? '#D80000' : '#0B0B0B',
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
        {message}
      </Text>
    </Pressable>
  );
}
