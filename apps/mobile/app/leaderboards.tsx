import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { LeaderboardCategory, LeaderboardEntry } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';
import {
  HubCard,
  HubLoading,
  HubMessage,
  HubScreen,
  PillTabs,
} from '../src/components/hub/HubParts';

const CATEGORIES: { value: LeaderboardCategory; label: string }[] = [
  { value: 'MOST_RUNS', label: 'Most Runs' },
  { value: 'MOST_WICKETS', label: 'Most Wickets' },
  { value: 'MOST_SIXES', label: 'Most Sixes' },
  { value: 'BEST_STRIKE_RATE', label: 'Best Strike Rate' },
  { value: 'BEST_ECONOMY', label: 'Best Economy' },
  { value: 'HIGHEST_SKILL_RATING', label: 'Skill Rating' },
  { value: 'FAIR_PLAY', label: 'Fair Play' },
  { value: 'RELIABILITY', label: 'Reliability' },
];

// Top three get a filled red / black / grey medal; everyone else a plain rank number.
const MEDAL = ['#D80000', '#0D0D0D', '#8A8A8A'];

function RankBadge({ rank }: { rank: number }) {
  const medal = rank >= 1 && rank <= 3 ? MEDAL[rank - 1] : null;
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: medal ?? '#F1F1F1',
      }}
    >
      <Text
        className="font-ui font-bold"
        style={{ fontSize: 14, color: medal ? '#FFFFFF' : colors.textTertiary }}
      >
        {rank}
      </Text>
    </View>
  );
}

// Rankings & Leaderboards (long tail, PRD §12.33) — see leaderboardService.ts
// for exactly which categories this first cut covers and why.
export default function LeaderboardsScreen() {
  const [category, setCategory] = useState<LeaderboardCategory>('MOST_RUNS');
  const [results, setResults] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getLeaderboard(category)
      .then((res) => setResults(res.results))
      .catch(() => setError('Could not load the leaderboard.'))
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <HubScreen
      title="Leaderboards"
      subtitle="See who is leading the game"
      backTestID="leaderboards-back"
      testID="leaderboards-screen"
      controls={
        <PillTabs
          items={CATEGORIES}
          value={category}
          onChange={setCategory}
          testIDPrefix="leaderboard-category"
          containerTestID="leaderboard-category-scroll"
          scroll
        />
      }
    >
      {loading && <HubLoading testID="leaderboards-loading" />}

      {!loading && error && <HubMessage tone="error">{error}</HubMessage>}

      {!loading && !error && results.length === 0 && (
        <HubMessage icon="podium" testID="leaderboards-empty">
          No qualifying players yet for this leaderboard.
        </HubMessage>
      )}

      {!loading &&
        !error &&
        results.map((entry) => (
          <HubCard
            key={entry.player_id}
            style={{ marginBottom: 8, paddingVertical: 10 }}
            testID={`leaderboard-row-${entry.player_id}`}
          >
            <View className="flex-row items-center">
              <RankBadge rank={entry.rank} />
              <Text
                className="font-ui font-bold text-ink-black flex-1"
                style={{ fontSize: 15, marginLeft: 12 }}
                numberOfLines={1}
              >
                {entry.full_name || entry.bfam_id}
              </Text>
              <Text className="font-display text-brand-red" style={{ fontSize: 22 }}>
                {entry.value}
              </Text>
            </View>
          </HubCard>
        ))}
    </HubScreen>
  );
}
