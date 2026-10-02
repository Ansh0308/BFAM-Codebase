import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { BookingMatches, SlotMatch } from '@bfam/shared-types';
import { apiClient } from '../lib/apiClient';
import { BallLoader } from './BallLoader';
import { Button } from './Button';
import { StatusBadge, type StatusVariant } from './StatusBadge';
import { formatTimeForDisplay } from './DateTimeFields';
import { istHHMM } from '../lib/slotTime';

const STATUS: Record<string, { label: string; variant: StatusVariant }> = {
  OPEN: { label: 'Not started', variant: 'info' },
  PENDING: { label: 'Not started', variant: 'warning' },
  CONFIRMED: { label: 'Not started', variant: 'info' },
  IN_PROGRESS: { label: 'Live', variant: 'live' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

const t = (instant: string) => formatTimeForDisplay(istHHMM(instant));

// What a match actually took: nobody can say in advance when a match will end, so the
// times shown are the real start and finish, recorded as the match is played.
export function matchTimingText(
  m: Pick<SlotMatch, 'match_status' | 'actual_start_time' | 'actual_end_time'>,
) {
  if (m.match_status === 'CANCELLED') return 'Cancelled';
  if (m.match_status === 'COMPLETED' && m.actual_start_time && m.actual_end_time) {
    return `Played ${t(m.actual_start_time)} – ${t(m.actual_end_time)}`;
  }
  if (m.match_status === 'COMPLETED') return 'Completed';
  if (m.match_status === 'IN_PROGRESS' && m.actual_start_time) {
    return `Started ${t(m.actual_start_time)} · in progress`;
  }
  if (m.match_status === 'IN_PROGRESS') return 'In progress';
  return 'Not started yet';
}

// "Your slot": a booked slot of an hour or two usually holds several matches, played one
// after another. This lists them (with when each really started and finished), and lets
// the booker create the next one once the previous is done - until the slot ends.
export function SlotMatches({
  bookingId,
  canAddMatch = true,
}: {
  bookingId: string;
  canAddMatch?: boolean;
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

  return (
    <View testID="slot-matches">
      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
        Matches in this slot
      </Text>

      {data.matches.length === 0 ? (
        <Text className="font-ui text-body text-text-secondary" testID="slot-no-matches">
          {data.slot_state === 'PASSED'
            ? 'No match was played in this slot.'
            : 'No match yet. Create the first one for this slot.'}
        </Text>
      ) : (
        data.matches.map((m, index) => {
          const status = STATUS[m.match_status] ?? STATUS.OPEN;
          return (
            <Pressable
              key={m.match_id}
              onPress={() => router.push(`/(tabs)/matches/${m.match_id}`)}
              className="flex-row items-center justify-between bg-surface-alt rounded-md p-3 mb-2"
              testID={`slot-match-${m.match_id}`}
            >
              <View className="flex-1 pr-3">
                <Text className="font-ui font-bold text-body text-ink-black" numberOfLines={1}>
                  {m.match_name || `Match ${index + 1}`}
                </Text>
                <Text className="font-ui text-micro text-text-secondary mt-0.5">
                  {matchTimingText(m)} · {m.overs_per_innings} overs
                </Text>
              </View>
              <StatusBadge label={status.label} variant={status.variant} />
            </Pressable>
          );
        })
      )}

      {canAddMatch && data.can_add_match ? (
        <View className="mt-3">
          <Button
            label={data.matches.length === 0 ? 'Create a match' : 'Create the next match'}
            variant="secondary"
            onPress={() => router.push(`/(tabs)/matches/create?bookingId=${bookingId}`)}
            testID="add-match-in-slot"
          />
        </View>
      ) : data.reason ? (
        <Text className="font-ui text-micro text-text-tertiary mt-1" testID="slot-blocked-reason">
          {data.reason}
        </Text>
      ) : null}
    </View>
  );
}
