import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SupportTicket } from '@bfam/shared-types';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'text-text-secondary',
  IN_PROGRESS: 'text-brand-red',
  RESOLVED: 'text-brand-red',
  CLOSED: 'text-text-tertiary',
};

// Complaint Status (module 2.13, PRD §12.57) — every ticket the caller has
// raised, incl. disputes and injury reports (same underlying table, see
// dispute_type on the SupportTicket type).
export default function ComplaintStatusScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getMyTickets()
      .then((res) => setTickets(res.results))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="px-5 flex-1" testID="complaint-status-screen">
        <ScreenHeader title="Complaint Status" />
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            style={{ marginTop: 24 }}
            testID="complaint-status-loading"
          />
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(t) => t.ticket_id}
            testID="complaint-status-list"
            ListEmptyComponent={
              <Text
                className="font-ui text-body text-text-tertiary mt-4"
                testID="complaint-status-empty"
              >
                You haven&apos;t raised any tickets yet.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/complaint-status/${item.ticket_id}`)}
                className="bg-surface-alt rounded-lg p-4 mb-3"
                testID={`ticket-row-${item.ticket_id}`}
              >
                <Text className="font-ui font-bold text-body text-text-primary">
                  {item.category.replace('_', ' ')}
                </Text>
                <Text className="font-ui text-micro text-text-tertiary mt-1" numberOfLines={2}>
                  {item.description}
                </Text>
                <Text
                  className={`font-ui font-bold text-micro uppercase mt-2 ${STATUS_COLOR[item.status]}`}
                >
                  {item.status.replace('_', ' ')}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
