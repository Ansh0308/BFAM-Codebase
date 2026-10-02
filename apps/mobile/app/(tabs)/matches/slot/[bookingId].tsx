import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import type { Booking } from '@bfam/shared-types';
import { apiClient } from '../../../../src/lib/apiClient';
import { BallLoader } from '../../../../src/components/BallLoader';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { SlotMatches } from '../../../../src/components/SlotMatches';
import { StatusBadge } from '../../../../src/components/StatusBadge';
import {
  formatDateForDisplay,
  formatTimeForDisplay,
} from '../../../../src/components/DateTimeFields';
import { slotState } from '../../../../src/lib/slotTime';

const STATE_BADGE = {
  UPCOMING: { label: 'Upcoming', variant: 'info' },
  ACTIVE: { label: 'Slot is on now', variant: 'live' },
  PASSED: { label: 'Slot ended', variant: 'neutral' },
} as const;

// One booked slot: when it is, the matches played in it so far, and (while the slot is
// still running and the earlier matches are done) a way to create the next one.
export default function SlotScreen() {
  const { bookingId, turfName } = useLocalSearchParams<{ bookingId: string; turfName?: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      apiClient
        .getBookingDetails(bookingId)
        .then(setBooking)
        .catch(() => setBooking(null))
        .finally(() => setLoading(false));
    }, [bookingId]),
  );

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <BallLoader testID="slot-loading" />
        </View>
      </ScreenContainer>
    );
  }
  if (!booking) {
    return (
      <ScreenContainer back="/(tabs)/matches">
        <View className="flex-1 items-center justify-center">
          <Text className="font-ui text-body text-text-secondary" testID="slot-error">
            Could not load this slot.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const state = slotState(booking);
  const badge = STATE_BADGE[state];

  return (
    <ScrollView className="flex-1 bg-surface" testID="slot-screen">
      <View className="px-6 pt-6 pb-10">
        <View className="flex-row items-center justify-between">
          <Text className="font-ui font-bold text-title-xl text-ink-black flex-1 pr-3">
            {turfName || booking.turf_name || 'Your slot'}
          </Text>
          <StatusBadge label={badge.label} variant={badge.variant} testID="slot-state" />
        </View>
        <Text className="font-ui text-body text-text-secondary mt-1" testID="slot-when">
          {formatDateForDisplay(booking.booking_date)} ·{' '}
          {formatTimeForDisplay(booking.start_time.slice(0, 5))} –{' '}
          {formatTimeForDisplay(booking.end_time.slice(0, 5))}
        </Text>
        <Text className="font-ui text-micro text-text-tertiary mt-2">
          Matches in a slot are played one after another. When one finishes you can create the next,
          as long as the slot has not ended.
        </Text>

        <View className="mt-6">
          <SlotMatches bookingId={booking.booking_id} />
        </View>
      </View>
    </ScrollView>
  );
}
