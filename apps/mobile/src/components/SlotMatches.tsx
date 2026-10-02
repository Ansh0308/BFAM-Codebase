import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { BookingMatches } from '@bfam/shared-types';
import { apiClient } from '../lib/apiClient';
import { BallLoader } from './BallLoader';
import { Button } from './Button';
import { StatusBadge, type StatusVariant } from './StatusBadge';
import { formatTimeForDisplay } from './DateTimeFields';
import { freeWindows, istHHMM } from '../lib/slotTime';

const STATUS: Record<string, { label: string; variant: StatusVariant }> = {
  OPEN: { label: 'Open', variant: 'info' },
  PENDING: { label: 'Pending', variant: 'warning' },
  CONFIRMED: { label: 'Confirmed', variant: 'info' },
  IN_PROGRESS: { label: 'Live', variant: 'live' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

// "Your slot": a booked slot of an hour or two usually holds several matches, so this
// lists the ones already set up (each with its own start and end), shows what time is
// still free, and lets the booker add another match in it.
export function SlotMatches({
  bookingId,
  canAddMatch,
}: {
  bookingId: string;
  canAddMatch: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<BookingMatches | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFailed(false);
      apiClient
        .getBookingMatches(bookingId)
        .then(setData)
        .catch(() => setFailed(true))
        .finally(() => setLoading(false));
    }, [bookingId]),
  );

  if (loading) return <BallLoader size="inline" testID="slot-matches-loading" />;
  if (failed || !data) return null;

  const free = freeWindows(data.slot_start_time, data.slot_end_time, data.matches);
  const hasFreeTime = free.length > 0;

  return (
    <View className="mt-6" testID="slot-matches">
      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
        Matches in this slot
      </Text>

      {data.matches.length === 0 ? (
        <Text className="font-ui text-body text-text-secondary" testID="slot-no-matches">
          No match set up yet. Add one for any time in your slot.
        </Text>
      ) : (
        data.matches.map((m) => {
          const status = STATUS[m.match_status] ?? STATUS.OPEN;
          const from = formatTimeForDisplay(istHHMM(m.scheduled_start_time));
          const to = m.scheduled_end_time
            ? formatTimeForDisplay(istHHMM(m.scheduled_end_time))
            : formatTimeForDisplay(data.slot_end_time.slice(0, 5));
          return (
            <Pressable
              key={m.match_id}
              onPress={() => router.push(`/(tabs)/matches/${m.match_id}`)}
              className="flex-row items-center justify-between bg-surface-alt rounded-md p-3 mb-2"
              testID={`slot-match-${m.match_id}`}
            >
              <View className="flex-1 pr-3">
                <Text className="font-ui font-bold text-body text-ink-black" numberOfLines={1}>
                  {m.match_name || 'Match'}
                </Text>
                <Text className="font-ui text-micro text-text-secondary mt-0.5">
                  {from} – {to} · {m.overs_per_innings} overs
                </Text>
              </View>
              <StatusBadge label={status.label} variant={status.variant} />
            </Pressable>
          );
        })
      )}

      <Text className="font-ui text-micro text-text-tertiary mt-1" testID="slot-free-time">
        {hasFreeTime
          ? `Free: ${free
              .map((w) => `${formatTimeForDisplay(w.from)} – ${formatTimeForDisplay(w.to)}`)
              .join(', ')}`
          : 'The slot is fully booked with matches.'}
      </Text>

      {canAddMatch && hasFreeTime ? (
        <View className="mt-3">
          <Button
            label="Add a match in this slot"
            variant="secondary"
            onPress={() => router.push(`/(tabs)/matches/create?bookingId=${bookingId}`)}
            testID="add-match-in-slot"
          />
        </View>
      ) : null}
    </View>
  );
}
