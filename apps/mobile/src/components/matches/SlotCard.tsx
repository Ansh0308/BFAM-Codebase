import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Booking } from '@bfam/shared-types';
import { StatusBadge } from '../StatusBadge';
import { formatDateForDisplay, formatTimeForDisplay } from '../DateTimeFields';
import { slotState } from '../../lib/slotTime';

const BADGE = {
  UPCOMING: { label: 'Upcoming', variant: 'info' },
  ACTIVE: { label: 'On now', variant: 'live' },
  PASSED: { label: 'Ended', variant: 'neutral' },
} as const;

// One of the player's booked slots on the Matches tab; tapping it opens the slot, where
// its matches are listed and the next one can be created.
export function SlotCard({
  booking,
  onPress,
  now,
}: {
  booking: Booking;
  onPress: () => void;
  now?: Date;
}) {
  const badge = BADGE[slotState(booking, now)];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={`slot-card-${booking.booking_id}`}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        padding: 16,
        marginBottom: 12,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-ui font-bold text-ink-black flex-1 pr-3" style={{ fontSize: 16 }}>
          {booking.turf_name ?? 'Turf'}
        </Text>
        <StatusBadge label={badge.label} variant={badge.variant} />
      </View>
      <View className="flex-row items-center" style={{ marginTop: 8 }}>
        <Feather name="calendar" size={14} color="#767676" />
        <Text className="font-ui text-text-secondary" style={{ fontSize: 13, marginLeft: 8 }}>
          {formatDateForDisplay(booking.booking_date)}
        </Text>
        <Feather name="clock" size={14} color="#767676" style={{ marginLeft: 14 }} />
        <Text className="font-ui text-text-secondary" style={{ fontSize: 13, marginLeft: 8 }}>
          {formatTimeForDisplay(booking.start_time.slice(0, 5))} –{' '}
          {formatTimeForDisplay(booking.end_time.slice(0, 5))}
        </Text>
      </View>
      <Text className="font-ui font-bold text-brand-red" style={{ fontSize: 13, marginTop: 10 }}>
        View matches in this slot →
      </Text>
    </Pressable>
  );
}
