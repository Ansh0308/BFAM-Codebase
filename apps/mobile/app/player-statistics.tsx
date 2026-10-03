import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { PlayerStatistics, StatisticsScope } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import {
  HeroCard,
  HubLoading,
  HubMessage,
  HubScreen,
  PillTabs,
  StatTile,
} from '../src/components/hub/HubParts';

const SCOPES: { value: StatisticsScope; label: string }[] = [
  { value: 'lifetime', label: 'Lifetime' },
  { value: 'season', label: 'Season' },
];

// Player Statistics screen (module 2.10, PRD §12.32) — replaces the "Career
// Stats" placeholder on Player Profile (module 2.2). `playerId` defaults to
// "me" (the viewer's own stats); a real player_id can be passed to view a
// teammate's.
export default function PlayerStatisticsScreen() {
  const params = useLocalSearchParams<{ playerId?: string }>();
  const playerId = params.playerId ?? 'me';

  const [scope, setScope] = useState<StatisticsScope>('lifetime');
  const [stats, setStats] = useState<PlayerStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getPlayerStatistics(playerId, scope)
      .then(setStats)
      .catch(() => setError('Could not load statistics.'))
      .finally(() => setLoading(false));
  }, [playerId, scope]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <HubScreen
      title="Statistics"
      subtitle="Your match performance"
      backTestID="player-statistics-back"
      testID="player-statistics-screen"
      controls={
        <PillTabs
          items={SCOPES}
          value={scope}
          onChange={setScope}
          testIDPrefix="statistics-scope"
          containerTestID="statistics-scope-toggle"
        />
      }
    >
      {loading && <HubLoading testID="statistics-loading" />}

      {!loading && error && <HubMessage tone="error">{error}</HubMessage>}

      {!loading && !error && stats && (
        <>
          {stats.matches_played === 0 ? (
            <HubMessage icon="chart-line" testID="statistics-empty">
              {scope === 'season'
                ? 'No matches played this season yet.'
                : 'No completed matches yet — stats appear here once you finish one.'}
            </HubMessage>
          ) : (
            <>
              <HeroCard>
                <Text
                  className="font-ui"
                  style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' }}
                >
                  {scope === 'season' ? 'RUNS THIS SEASON' : 'CAREER RUNS'}
                </Text>
                <Text
                  className="font-display"
                  style={{ fontSize: 52, lineHeight: 58, color: '#FFFFFF', marginTop: 2 }}
                >
                  {stats.runs}
                </Text>
                <Text className="font-ui" style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
                  in {stats.matches_played} match{stats.matches_played === 1 ? '' : 'es'}
                  {stats.best_score != null ? ` · best ${stats.best_score}` : ''}
                </Text>
              </HeroCard>

              <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
                <StatTile
                  icon="calendar-check"
                  label="Matches"
                  value={String(stats.matches_played)}
                />
                <StatTile icon="run-fast" label="Runs" value={String(stats.runs)} />
                <StatTile icon="bowling" label="Wickets" value={String(stats.wickets)} />
                <StatTile
                  icon="star-circle"
                  label="Best Score"
                  value={stats.best_score != null ? String(stats.best_score) : '—'}
                />
                <StatTile
                  icon="speedometer"
                  label="Strike Rate"
                  value={stats.strike_rate != null ? stats.strike_rate.toFixed(2) : '—'}
                />
                <StatTile
                  icon="chart-line"
                  label="Economy"
                  value={stats.economy != null ? stats.economy.toFixed(2) : '—'}
                />
                <StatTile icon="hand-back-right" label="Catches" value={String(stats.catches)} />
                <StatTile
                  icon="trophy"
                  label="Player of Match"
                  value={String(stats.player_of_the_match_count)}
                />
                {scope === 'season' && (
                  <StatTile
                    icon="fire"
                    label="Current Streak"
                    value={String(stats.current_streak ?? 0)}
                  />
                )}
              </View>
            </>
          )}
        </>
      )}
    </HubScreen>
  );
}
