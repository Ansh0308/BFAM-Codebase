import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Match } from '@bfam/shared-types';
import { apiClient } from '../../../src/lib/apiClient';
import { colors } from '../../../src/theme/tokens';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { Button } from '../../../src/components/Button';

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'Live',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function formatMatchTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// My Matches (module 2.6 — Matches tab). Every match the caller organizes,
// scores, or is on the roster for.
export default function MyMatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getMyMatches()
      .then((res) => setMatches(res.results))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScreenContainer>
      <View className="pt-6 flex-1" testID="my-matches-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black mb-4">Matches</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.brandRed} testID="my-matches-loading" />
        ) : matches.length === 0 ? (
          <View className="items-center mt-8">
            <View
              className="rounded-full bg-surface-alt items-center justify-center mb-4"
              style={{ width: 64, height: 64 }}
            >
              <MaterialCommunityIcons name="cricket" size={28} color="#9A9A9A" />
            </View>
            <Text className="font-ui text-body text-text-secondary text-center mb-6">
              No matches yet. Book a turf, then create a match for it.
            </Text>
            <Button
              label="Book a Turf"
              variant="secondary"
              onPress={() => router.push('/(tabs)/discover')}
              testID="my-matches-empty-book-turf"
            />
          </View>
        ) : (
          <FlatList
            data={matches}
            keyExtractor={(item) => item.match_id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(tabs)/matches/${item.match_id}`)}
                className="flex-row items-center bg-surface rounded-lg border border-border-subtle p-4 mb-3"
                testID={`my-match-row-${item.match_id}`}
              >
                <View
                  className="rounded-full bg-surface-alt items-center justify-center mr-4"
                  style={{ width: 48, height: 48 }}
                >
                  <MaterialCommunityIcons name="cricket" size={20} color="#D80000" />
                </View>
                <View className="flex-1">
                  <Text
                    className="font-ui font-semibold text-card-title text-ink-black"
                    numberOfLines={1}
                  >
                    {item.match_name ?? `${item.match_type} match`}
                  </Text>
                  <Text className="text-text-secondary text-body mt-0.5">
                    {formatMatchTime(item.scheduled_start_time)}
                  </Text>
                </View>
                <View className="rounded-full border border-brand-red px-2 py-0.5">
                  <Text className="font-ui text-micro font-bold text-brand-red">
                    {STATUS_LABEL[item.match_status] ?? item.match_status}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
