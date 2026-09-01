import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import type { GameRoom, MatchPlayer } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { Avatar } from '../../../../src/components/Avatar';
import { useAuthStore } from '../../../../src/store/authStore';

const CONFIRMATION_META: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: 'Confirmed', color: '#D80000' },
  MAYBE: { label: 'Maybe', color: '#B8860B' },
  CANT_PLAY: { label: "Can't Play", color: '#767676' },
  PENDING: { label: 'Pending', color: '#9A9A9A' },
  NO_RESPONSE: { label: 'No Response', color: '#9A9A9A' },
};
const ATTENDANCE_META: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  CHECKED_IN: { label: 'Checked In', icon: 'check-circle' },
  RUNNING_LATE: { label: 'Running Late', icon: 'clock' },
  NO_SHOW: { label: 'No Show', icon: 'x-circle' },
  PENDING: { label: '', icon: 'circle' },
};

function formatMatchTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Game Room (PRD §12.10): match info, roster with confirmations +
// attendance, payment status, attendance summary. "Start Match" is a stub
// only — module 2.7 (Countdown Intro) owns the real flow.
export default function GameRoomScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startMessage, setStartMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getGameRoom(matchId)
      .then(setRoom)
      .catch(() => setError('Could not load this match.'))
      .finally(() => setLoading(false));
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function withBusy(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="game-room-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (!room) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="game-room-error">
          <Text className="font-ui text-body text-text-secondary text-center">
            {error ?? 'Could not load this match.'}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const myRow = room.players.find((p) => p.bfam_id === user?.bfam_id);
  const isOrganizer = room.organizer_id === user?.user_id;
  const isManager = isOrganizer || room.assigned_scorer_id === user?.user_id;
  const iHavePendingInvite = myRow && ['PENDING', 'NO_RESPONSE'].includes(myRow.invitation_status);

  return (
    <ScrollView className="flex-1 bg-surface" testID="game-room-screen">
      <View className="px-6 pt-6">
        <Text className="font-ui font-bold text-title-xl text-ink-black">
          {room.match_name ?? `${room.match_type} match`}
        </Text>
        <View className="flex-row items-center mt-1">
          <Feather name="calendar" size={13} color="#767676" />
          <Text className="text-text-secondary text-body ml-1">
            {formatMatchTime(room.scheduled_start_time)}
          </Text>
        </View>
        <Text className="text-text-tertiary text-micro mt-1">
          {room.ball_type} · {room.overs_per_innings} overs · {room.scoring_mode.replace('_', ' ')}
        </Text>

        {error && <Text className="text-brand-red text-body mt-4">{error}</Text>}

        {iHavePendingInvite && (
          <View className="bg-surface-alt rounded-lg border border-brand-red p-4 mt-5">
            <Text className="font-ui font-semibold text-body text-ink-black mb-3">
              You&apos;re invited to this match — will you play?
            </Text>
            <View className="flex-row">
              <View className="flex-1 mr-2">
                <Button
                  label="Confirm"
                  onPress={() =>
                    withBusy(() =>
                      apiClient.respondToMatch(matchId, 'CONFIRMED').then(() => undefined),
                    )
                  }
                  loading={busy}
                  testID="respond-confirmed"
                />
              </View>
              <View className="flex-1 mr-2">
                <Button
                  label="Maybe"
                  variant="secondary"
                  onPress={() =>
                    withBusy(() => apiClient.respondToMatch(matchId, 'MAYBE').then(() => undefined))
                  }
                  loading={busy}
                  testID="respond-maybe"
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Can't Play"
                  variant="secondary"
                  onPress={() =>
                    withBusy(() =>
                      apiClient.respondToMatch(matchId, 'CANT_PLAY').then(() => undefined),
                    )
                  }
                  loading={busy}
                  testID="respond-cant-play"
                />
              </View>
            </View>
          </View>
        )}

        {/* Attendance summary */}
        <View className="flex-row flex-wrap mt-5" style={{ marginHorizontal: -4 }}>
          {[
            { label: 'Confirmed', value: room.attendance_summary.confirmed },
            { label: 'Maybe', value: room.attendance_summary.maybe },
            { label: "Can't Play", value: room.attendance_summary.cant_play },
            { label: 'Checked In', value: room.attendance_summary.checked_in },
          ].map((stat) => (
            <View key={stat.label} className="bg-surface-alt rounded-md px-3 py-2 m-1">
              <Text className="font-ui font-bold text-stat-sm text-ink-black">{stat.value}</Text>
              <Text className="font-ui text-micro text-text-tertiary">{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Payment status */}
        <View className="flex-row items-center justify-between bg-surface-alt rounded-md border border-border-subtle px-4 py-3 mt-4">
          <View className="flex-row items-center">
            <Feather name="credit-card" size={16} color="#767676" />
            <Text className="font-ui text-body text-text-primary ml-2">Payment</Text>
          </View>
          <Text
            className={[
              'font-ui font-semibold text-body',
              room.payment.fully_paid ? 'text-brand-red' : 'text-text-secondary',
            ].join(' ')}
          >
            {room.payment.fully_paid
              ? 'Fully Paid'
              : `₹${room.payment.total_paid} / ₹${room.payment.total_due}`}
          </Text>
        </View>

        {/* Actions */}
        {myRow &&
          myRow.invitation_status === 'CONFIRMED' &&
          myRow.attendance_status === 'PENDING' && (
            <View className="mt-4">
              <Button
                label="I'm Running Late"
                variant="secondary"
                onPress={() =>
                  withBusy(() => apiClient.updateMyAttendance(matchId, 'RUNNING_LATE'))
                }
                loading={busy}
                testID="mark-running-late"
              />
            </View>
          )}
        <View className="mt-3">
          <Button
            label="Check In"
            variant="secondary"
            iconLeft={<Feather name="maximize" size={16} color="#D80000" />}
            onPress={() => router.push(`/(tabs)/matches/${matchId}/check-in`)}
            testID="open-check-in"
          />
        </View>
        {isManager && (
          <View className="mt-3">
            <Button
              label="Invite Players"
              variant="secondary"
              iconLeft={<Feather name="user-plus" size={16} color="#D80000" />}
              onPress={() => router.push(`/(tabs)/matches/${matchId}/invite`)}
              testID="open-invite"
            />
          </View>
        )}

        {/* Roster */}
        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-6 mb-2">
          Roster ({room.players.length})
        </Text>
        {room.players.map((player) => (
          <RosterRow
            key={player.match_player_id}
            player={player}
            isManager={isManager}
            isSelf={player.bfam_id === user?.bfam_id}
            onVacate={() =>
              withBusy(async () => {
                await apiClient.vacateMatchSpot(matchId, player.player_id);
              })
            }
          />
        ))}

        {isManager && (
          <View className="mt-6 mb-3">
            <Button
              label="Start Match"
              onPress={() =>
                apiClient
                  .startMatchStub(matchId)
                  .then((res) => setStartMessage(res.message))
                  .catch(() => setStartMessage('Could not start the match.'))
              }
              testID="start-match-stub"
            />
          </View>
        )}
        {startMessage && (
          <Text className="font-ui text-micro text-text-tertiary text-center mb-6">
            {startMessage}
          </Text>
        )}
        <View className="mb-10" />
      </View>
    </ScrollView>
  );
}

function RosterRow({
  player,
  isManager,
  isSelf,
  onVacate,
}: {
  player: MatchPlayer;
  isManager: boolean;
  isSelf: boolean;
  onVacate: () => void;
}) {
  const confirmation = CONFIRMATION_META[player.invitation_status] ?? {
    label: player.invitation_status,
    color: '#9A9A9A',
  };
  const attendance = ATTENDANCE_META[player.attendance_status];
  const canVacate = (isSelf || isManager) && player.invitation_status === 'CONFIRMED';

  return (
    <View
      className="flex-row items-center justify-between py-3 border-b border-border-subtle"
      testID={`roster-row-${player.player_id}`}
    >
      <View className="flex-row items-center flex-1">
        <Avatar size={36} />
        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Text className="text-text-primary text-body">{player.bfam_id}</Text>
            {player.participant_role === 'CAPTAIN' && (
              <View className="ml-2 rounded-full border border-brand-red px-2 py-0.5">
                <Text className="font-ui text-micro font-bold text-brand-red">Captain</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center mt-1">
            <View
              className="rounded-full px-2 py-0.5"
              style={{ borderWidth: 1, borderColor: confirmation.color }}
            >
              <Text className="font-ui text-micro font-bold" style={{ color: confirmation.color }}>
                {confirmation.label}
              </Text>
            </View>
            {attendance?.label ? (
              <View className="flex-row items-center ml-2">
                <Feather name={attendance.icon} size={12} color="#767676" />
                <Text className="font-ui text-micro text-text-tertiary ml-1">
                  {attendance.label}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      {canVacate && (
        <Pressable
          onPress={onVacate}
          className="rounded-full bg-surface-alt items-center justify-center"
          style={{ width: 34, height: 34 }}
          testID={`vacate-${player.player_id}`}
          accessibilityLabel="Vacate spot / find replacement"
        >
          <Feather name="user-minus" size={16} color="#D80000" />
        </Pressable>
      )}
    </View>
  );
}
