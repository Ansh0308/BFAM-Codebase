import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Scorecard } from '@bfam/shared-types';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';

// Scorecard (PRD §12.18 requirement 4): batting/bowling tables, extras
// breakdown, fall of wickets — aggregated live from score_events.
export default function ScorecardScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getScorecard(matchId)
      .then(setScorecard)
      .catch(() => setScorecard(null))
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="scorecard-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (!scorecard || scorecard.innings.length === 0) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="scorecard-empty">
          <Text className="font-ui text-body text-text-secondary text-center">
            No scoring recorded yet.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface" testID="scorecard-screen">
      <View className="px-6 pt-6 pb-10">
        {scorecard.innings.map((inn) => (
          <View
            key={inn.innings_id}
            className="mb-8"
            testID={`scorecard-innings-${inn.innings_number}`}
          >
            <Text className="font-ui font-bold text-section-header text-ink-black mb-3">
              Innings {inn.innings_number} — {inn.total_runs}/{inn.total_wickets} (
              {inn.overs_completed} ov)
            </Text>

            <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
              Batting
            </Text>
            <View className="flex-row py-2 border-b border-border-strong">
              <Text className="flex-1 font-ui font-bold text-micro text-text-tertiary">Player</Text>
              <Text className="w-10 font-ui font-bold text-micro text-text-tertiary text-right">
                R
              </Text>
              <Text className="w-10 font-ui font-bold text-micro text-text-tertiary text-right">
                B
              </Text>
              <Text className="w-8 font-ui font-bold text-micro text-text-tertiary text-right">
                4s
              </Text>
              <Text className="w-8 font-ui font-bold text-micro text-text-tertiary text-right">
                6s
              </Text>
            </View>
            {inn.batting.map((b) => (
              <View
                key={b.player_id}
                className="flex-row py-2 border-b border-border-subtle"
                testID={`batting-row-${b.player_id}`}
              >
                <Text className="flex-1 font-ui text-body text-text-primary">
                  {b.bfam_id}
                  {b.out ? '' : ' *'}
                </Text>
                <Text className="w-10 font-ui text-body text-text-primary text-right">
                  {b.runs}
                </Text>
                <Text className="w-10 font-ui text-body text-text-secondary text-right">
                  {b.balls}
                </Text>
                <Text className="w-8 font-ui text-body text-text-secondary text-right">
                  {b.fours}
                </Text>
                <Text className="w-8 font-ui text-body text-text-secondary text-right">
                  {b.sixes}
                </Text>
              </View>
            ))}

            <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-5 mb-2">
              Bowling
            </Text>
            <View className="flex-row py-2 border-b border-border-strong">
              <Text className="flex-1 font-ui font-bold text-micro text-text-tertiary">Player</Text>
              <Text className="w-10 font-ui font-bold text-micro text-text-tertiary text-right">
                O
              </Text>
              <Text className="w-10 font-ui font-bold text-micro text-text-tertiary text-right">
                R
              </Text>
              <Text className="w-8 font-ui font-bold text-micro text-text-tertiary text-right">
                W
              </Text>
              <Text className="w-12 font-ui font-bold text-micro text-text-tertiary text-right">
                Econ
              </Text>
            </View>
            {inn.bowling.map((b) => (
              <View
                key={b.player_id}
                className="flex-row py-2 border-b border-border-subtle"
                testID={`bowling-row-${b.player_id}`}
              >
                <Text className="flex-1 font-ui text-body text-text-primary">{b.bfam_id}</Text>
                <Text className="w-10 font-ui text-body text-text-secondary text-right">
                  {b.overs}
                </Text>
                <Text className="w-10 font-ui text-body text-text-secondary text-right">
                  {b.runs_conceded}
                </Text>
                <Text className="w-8 font-ui text-body text-text-primary text-right">
                  {b.wickets}
                </Text>
                <Text className="w-12 font-ui text-body text-text-secondary text-right">
                  {b.economy}
                </Text>
              </View>
            ))}

            <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-5 mb-2">
              Extras
            </Text>
            <Text className="font-ui text-body text-text-primary" testID="extras-breakdown">
              Wide {inn.extras.WIDE} · No Ball {inn.extras.NO_BALL} · Bye {inn.extras.BYE} · Leg Bye{' '}
              {inn.extras.LEG_BYE}
            </Text>

            {inn.fall_of_wickets.length > 0 && (
              <>
                <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-5 mb-2">
                  Fall of Wickets
                </Text>
                <Text className="font-ui text-body text-text-primary" testID="fall-of-wickets">
                  {inn.fall_of_wickets
                    .map(
                      (f) =>
                        `${f.score}-${f.wicket_number} (${f.bfam_id}, ${f.over.toFixed(1)} ov)`,
                    )
                    .join(', ')}
                </Text>
              </>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
