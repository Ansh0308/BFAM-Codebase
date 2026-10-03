import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { MatchStreaks } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import {
  HeroCard,
  HubCard,
  HubLoading,
  HubMessage,
  HubScreen,
  IconBadge,
  SectionLabel,
} from '../src/components/hub/HubParts';

// Match Streaks (long tail, PRD §12.38) — "tracks consecutive
// participation to encourage regular play." Weekly-participation based,
// NOT a win streak (see domain/matchStreaks.ts for the reasoning, and
// Achievements' separate MATCH_STREAK win-based badge for the distinction).
export default function MatchStreaksScreen() {
  const [streaks, setStreaks] = useState<MatchStreaks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getPlayerMatchStreaks('me')
      .then(setStreaks)
      .catch(() => setError('Could not load your match streaks.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <HubScreen
      title="Match Streaks"
      subtitle="Keep playing, week after week"
      backTestID="match-streaks-back"
      testID="match-streaks-screen"
    >
      {loading && <HubLoading testID="match-streaks-loading" />}

      {!loading && error && <HubMessage tone="error">{error}</HubMessage>}

      {!loading && !error && streaks && (
        <>
          <HeroCard style={{ alignItems: 'center' }}>
            <IconBadge icon="fire" size={52} tone="red" />
            <Text
              className="font-ui"
              style={{
                fontSize: 11,
                letterSpacing: 1,
                color: 'rgba(255,255,255,0.8)',
                marginTop: 10,
              }}
            >
              CURRENT STREAK
            </Text>
            <Text
              className="font-display"
              style={{ fontSize: 64, lineHeight: 72, color: '#FFFFFF' }}
              testID="current-streak-value"
            >
              {streaks.current_streak}
            </Text>
            <Text className="font-ui" style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
              week{streaks.current_streak === 1 ? '' : 's'} in a row
            </Text>
          </HeroCard>

          <HubCard>
            <View className="flex-row items-center">
              <IconBadge icon="trophy" size={40} />
              <View className="flex-1" style={{ marginLeft: 12 }}>
                <Text
                  className="font-ui text-text-tertiary"
                  style={{ fontSize: 10.5, letterSpacing: 0.8 }}
                >
                  BEST STREAK
                </Text>
                <Text
                  className="font-ui text-text-secondary"
                  style={{ fontSize: 12.5, marginTop: 2 }}
                >
                  Your longest run so far
                </Text>
              </View>
              <View className="items-end">
                <Text
                  className="font-display text-ink-black"
                  style={{ fontSize: 30, lineHeight: 34 }}
                  testID="best-streak-value"
                >
                  {streaks.best_streak}
                </Text>
                <Text className="font-ui text-text-tertiary" style={{ fontSize: 11 }}>
                  week{streaks.best_streak === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          </HubCard>

          {streaks.current_streak === 0 && (
            <HubMessage icon="calendar-check" testID="match-streaks-encouragement">
              Play a match this week to start a new streak!
            </HubMessage>
          )}

          <SectionLabel>How streaks work</SectionLabel>
          <HubCard>
            <Text className="font-ui text-text-secondary" style={{ fontSize: 13 }}>
              Finish at least one match in a week (Monday to Sunday) and that week counts. Every
              week in a row adds one to your streak; miss a week and it starts again.
            </Text>
          </HubCard>
        </>
      )}
    </HubScreen>
  );
}
