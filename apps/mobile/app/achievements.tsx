import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { AchievementStatus } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import {
  Chip,
  HeroCard,
  HubCard,
  HubLoading,
  HubMessage,
  HubScreen,
  IconBadge,
  ProgressBar,
} from '../src/components/hub/HubParts';

// Achievements & Badges (long tail, PRD §12.37) — see
// domain/achievements.ts for exactly which badges this first cut covers
// and their unlock criteria.
export default function AchievementsScreen() {
  const [achievements, setAchievements] = useState<AchievementStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getPlayerAchievements('me')
      .then((res) => setAchievements(res.results))
      .catch(() => setError('Could not load your achievements.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const earnedCount = achievements.filter((a) => a.earned).length;
  const percent = achievements.length ? (earnedCount / achievements.length) * 100 : 0;

  return (
    <HubScreen
      title="Achievements"
      subtitle="Badges you unlock by playing"
      backTestID="achievements-back"
      testID="achievements-screen"
    >
      {loading && <HubLoading testID="achievements-loading" />}

      {!loading && error && <HubMessage tone="error">{error}</HubMessage>}

      {!loading && !error && (
        <HeroCard>
          <Text
            className="font-ui"
            style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' }}
          >
            BADGES
          </Text>
          <Text
            className="font-display"
            style={{ fontSize: 40, lineHeight: 46, color: '#FFFFFF', marginTop: 2 }}
            testID="achievements-count"
          >
            {earnedCount} of {achievements.length} earned
          </Text>
          <View style={{ marginTop: 14 }}>
            <ProgressBar onDark percent={percent} />
          </View>
        </HeroCard>
      )}

      {!loading && !error && (
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
          {achievements.map((a) => (
            <View key={a.id} style={{ width: '50%', paddingHorizontal: 5 }}>
              <HubCard
                style={{ flex: 1, minHeight: 150, opacity: a.earned ? 1 : 0.7 }}
                testID={`achievement-row-${a.id}`}
              >
                <IconBadge
                  icon={a.earned ? 'medal' : 'lock'}
                  size={40}
                  tone={a.earned ? 'solid' : 'muted'}
                />
                <Text
                  className="font-ui font-bold text-ink-black"
                  style={{ fontSize: 14, marginTop: 10 }}
                >
                  {a.name}
                </Text>
                <Text
                  className="font-ui text-text-tertiary"
                  style={{ fontSize: 11.5, marginTop: 3, flexGrow: 1 }}
                >
                  {a.description}
                </Text>
                <View className="flex-row" style={{ marginTop: 8 }}>
                  <Chip text={a.earned ? 'EARNED' : 'LOCKED'} tone={a.earned ? 'red' : 'muted'} />
                </View>
              </HubCard>
            </View>
          ))}
        </View>
      )}
    </HubScreen>
  );
}
