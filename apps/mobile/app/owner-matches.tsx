import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OwnerMatch } from '@bfam/shared-types';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

// Match Management (module 2.12, PRD §8.3/§9.2) — every match at any turf
// this owner runs, incl. starting the countdown intro from the Game Room
// screen module 2.6/2.7 already built (tapping through reuses it exactly —
// requirement 6: no separate owner-only match logic).
export default function OwnerMatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<OwnerMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getOwnerMatches()
      .then((res) => setMatches(res.results))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="px-5 flex-1" testID="owner-matches-screen">
        <ScreenHeader title="Match Management" />
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            style={{ marginTop: 24 }}
            testID="owner-matches-loading"
          />
        ) : (
          <FlatList
            data={matches}
            keyExtractor={(m) => m.match_id}
            testID="owner-matches-list"
            ListEmptyComponent={
              <Text
                className="font-ui text-body text-text-tertiary mt-4"
                testID="owner-matches-empty"
              >
                No matches yet at your turfs.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(tabs)/matches/${item.match_id}`)}
                className="bg-surface-alt rounded-lg p-4 mb-3"
                testID={`owner-match-${item.match_id}`}
              >
                <Text className="font-ui font-bold text-body text-text-primary">
                  {item.match_name ?? 'Match'} — {item.turf_name}
                </Text>
                <Text className="font-ui text-micro text-text-tertiary mt-1">
                  {item.match_status}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
