import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../../../src/components/ScreenContainer';
import { Button } from '../../../../../src/components/Button';
import { colors } from '../../../../../src/theme/tokens';
import { apiClient } from '../../../../../src/lib/apiClient';

export default function CancelBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmCancel = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.cancelBooking(bookingId, reason || undefined);
      router.replace(`/(tabs)/discover/booking/${bookingId}`);
    } catch {
      setError('Could not cancel this booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View testID="cancel-booking-screen" className="pt-6">
        <Text className="font-ui font-bold text-title-xl text-ink-black">Cancel Booking</Text>
        <Text className="font-ui text-body text-text-secondary mt-2">
          Let us know why you&apos;re cancelling (optional).
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

        <View className="mt-6">
          <Button
            label="Confirm Cancellation"
            onPress={confirmCancel}
            loading={submitting}
            testID="confirm-cancel-button"
          />
        </View>

        <View className="mt-3">
          <Button
            label="Never Mind, Keep My Booking"
            variant="ghost"
            onPress={() => router.back()}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
