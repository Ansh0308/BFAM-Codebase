import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { fetchPublishedBuildId, getBuildId, isNewerBuild } from '../lib/webUpdate';

const CHECK_EVERY_MS = 2 * 60 * 1000;

// Website only: when a newer version has been published, offer a one-tap reload. Checked
// when the page is shown again (tab switched back, phone unlocked) and every couple of
// minutes. Does nothing without a build id (local development).
export function UpdateBanner() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const buildId = getBuildId();
    if (Platform.OS !== 'web' || !buildId) return;
    let cancelled = false;

    async function check() {
      const published = await fetchPublishedBuildId();
      if (!cancelled && isNewerBuild(buildId, published)) setAvailable(true);
    }

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    const hasDocument = typeof document !== 'undefined';
    if (hasDocument) document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (hasDocument) document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!available) return null;
  return (
    <Pressable
      onPress={() => window.location.reload()}
      accessibilityRole="button"
      testID="update-banner"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: '#0B0B0B',
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
        A new version of BFAM is available. Tap to update.
      </Text>
    </Pressable>
  );
}
