import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { apiClient } from '../../lib/apiClient';
import { colors } from '../../theme/tokens';
import type { DiscoverStackParamList } from '../../navigation/types';

type Props = StackScreenProps<DiscoverStackParamList, 'CancelBooking'>;

export function CancelBookingScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmCancel = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.cancelBooking(bookingId, reason || undefined);
      navigation.navigate('BookingDetails', { bookingId });
    } catch {
      setError('Could not cancel this booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-surface px-6 pt-6" testID="cancel-booking-screen">
      <Text className="font-display text-title-xl text-ink-black uppercase">Cancel Booking</Text>
      <Text className="text-text-secondary text-body mt-2">
        Let us know why you're cancelling (optional).
      </Text>

      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Reason for cancellation"
        placeholderTextColor={colors.textTertiary}
        multiline
        className="bg-surface-alt border border-border-strong rounded-md px-4 py-3 mt-4 font-ui text-body text-text-primary min-h-[96px]"
        testID="cancellation-reason-input"
      />

      {error && <Text className="text-brand-red text-body mt-3">{error}</Text>}

      <Pressable
        onPress={confirmCancel}
        disabled={submitting}
        className="bg-brand-red rounded-md py-4 items-center mt-6"
        testID="confirm-cancel-button"
      >
        {submitting ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text className="font-ui font-bold text-surface text-button uppercase">
            Confirm Cancellation
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => navigation.goBack()} className="items-center mt-4">
        <Text className="text-text-secondary text-body">Never mind, keep my booking</Text>
      </Pressable>
    </View>
  );
}
