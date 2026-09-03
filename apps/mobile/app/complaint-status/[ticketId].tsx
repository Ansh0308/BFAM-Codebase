import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { SupportTicket } from '@bfam/shared-types';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { apiClient } from '../../src/lib/apiClient';
import { colors } from '../../src/theme/tokens';

// Complaint Status detail (module 2.13, PRD §12.57).
export default function ComplaintDetailScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getTicket(ticketId)
      .then(setTicket)
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  }, [ticketId]);

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="ticket-detail-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (!ticket) {
    return (
      <ScreenContainer>
        <Text
          className="font-ui text-body text-text-secondary text-center mt-8"
          testID="ticket-detail-error"
        >
          Could not load this ticket.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title="Ticket Details" />
      <View className="bg-surface-alt rounded-lg p-4 mb-4" testID="ticket-detail-card">
        <Text className="font-ui font-bold text-body text-text-primary">
          {ticket.category.replace('_', ' ')}
        </Text>
        <Text className="font-ui text-body text-text-secondary mt-2">{ticket.description}</Text>
        <Text
          className="font-ui font-bold text-micro uppercase text-brand-red mt-3"
          testID="ticket-detail-status"
        >
          {ticket.status.replace('_', ' ')}
        </Text>
      </View>
    </ScreenContainer>
  );
}
