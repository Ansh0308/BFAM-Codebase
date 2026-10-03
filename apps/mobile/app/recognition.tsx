import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { RecognitionAward, RecognitionAwardType } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';
import {
  Chip,
  HubCard,
  HubLoading,
  HubMessage,
  HubScreen,
  IconBadge,
  type IconName,
} from '../src/components/hub/HubParts';

const AWARD_LABELS: Record<
  RecognitionAwardType,
  { title: string; unit: string; singular?: string; icon: IconName }
> = {
  PLAYER_OF_THE_MONTH: { title: 'Player of the Month', unit: 'pts', icon: 'trophy' },
  BATTING_STAR: { title: 'Batting Star', unit: 'runs', icon: 'baseball-bat' },
  BOWLING_STAR: { title: 'Bowling Star', unit: 'wickets', singular: 'wicket', icon: 'bowling' },
  SPORTSMAN_OF_THE_MONTH: {
    title: 'Sportsman of the Month',
    unit: 'fair-play rating',
    icon: 'shield-star',
  },
};

// "YYYY-MM" plus/minus n months (UTC-safe).
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

// Special Recognition (long tail, PRD §12.39) — monthly awards; see
// recognitionService.ts (backend) for exactly how each is decided.
export default function RecognitionScreen() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [awards, setAwards] = useState<RecognitionAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getMonthlyRecognition(month)
      .then((res) => setAwards(res.awards))
      .catch(() => setError('Could not load recognition.'))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <HubScreen
      title="Recognition"
      subtitle="Monthly awards for the best on the turf"
      backTestID="recognition-back"
      testID="recognition-screen"
      controls={
        <View
          className="flex-row items-center justify-between bg-surface-alt border border-border-subtle"
          style={{ marginHorizontal: 20, borderRadius: 999, paddingHorizontal: 8, height: 46 }}
        >
          <Pressable
            onPress={() => setMonth(shiftMonth(month, -1))}
            hitSlop={8}
            accessibilityLabel="Previous month"
            testID="recognition-prev"
            style={{ padding: 6 }}
          >
            <Feather name="chevron-left" size={22} color={colors.inkBlack} />
          </Pressable>
          <Text
            className="font-ui font-bold text-ink-black"
            style={{ fontSize: 15 }}
            testID="recognition-month"
          >
            {month}
          </Text>
          <Pressable
            onPress={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= currentMonth}
            hitSlop={8}
            accessibilityLabel="Next month"
            testID="recognition-next"
            style={{ padding: 6 }}
          >
            <Feather
              name="chevron-right"
              size={22}
              color={month >= currentMonth ? '#B0B0B0' : colors.inkBlack}
            />
          </Pressable>
        </View>
      }
    >
      {error && <HubMessage tone="error">{error}</HubMessage>}
      {loading && <HubLoading testID="recognition-loading" />}
      {!loading && !error && awards.length === 0 && (
        <HubMessage icon="trophy-award">
          No awards for this month yet. Play a completed match to be in the running.
        </HubMessage>
      )}
      {!loading &&
        awards.map((a) => {
          const label = AWARD_LABELS[a.award];
          return (
            <HubCard key={a.award} testID={`award-${a.award}`}>
              <View className="flex-row items-center">
                <IconBadge icon={label.icon} size={46} tone="solid" />
                <View className="flex-1" style={{ marginLeft: 12 }}>
                  <Text
                    className="font-ui font-bold text-text-tertiary"
                    style={{ fontSize: 10.5, letterSpacing: 0.8 }}
                  >
                    {label.title.toUpperCase()}
                  </Text>
                  <Text
                    className="font-ui font-bold text-ink-black"
                    style={{ fontSize: 17, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {a.full_name ?? a.bfam_id}
                  </Text>
                </View>
              </View>
              <View className="flex-row" style={{ marginTop: 10 }}>
                <Chip
                  text={`${a.value} ${
                    a.value === 1 && label.singular ? label.singular : label.unit
                  }`}
                />
              </View>
            </HubCard>
          );
        })}
    </HubScreen>
  );
}
