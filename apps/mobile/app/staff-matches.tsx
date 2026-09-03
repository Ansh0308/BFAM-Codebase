import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OwnerMatch } from '@bfam/shared-types';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

// Match Operations (module 2.12, PRD §8.4/§9.3) — matches at any turf this
// staff member is assigned to. Tapping through reuses the exact Game Room/
// Live Score screens modules 2.6/2.8 already built (requirement 6).
export default function StaffMatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<OwnerMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getStaffMatches()
      .then((res) => setMatches(res.results))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="px-5 flex-1" testID="staff-matches-screen">
        <ScreenHeader title="Match Operations" />
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            style={{ marginTop: 24 }}
            testID="staff-matches-loading"
          />
        ) : (
          <FlatList
            data={matches}
            keyExtractor={(m) => m.match_id}
            testID="staff-matches-list"
            ListEmptyComponent={
              <Text
                className="font-ui text-body text-text-tertiary mt-4"
                testID="staff-matches-empty"
              >
                No matches yet at your assigned turf(s).
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(tabs)/matches/${item.match_id}`)}
                className="bg-surface-alt rounded-lg p-4 mb-3"
                testID={`staff-match-${item.match_id}`}
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
