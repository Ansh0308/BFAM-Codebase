import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BallLoader } from '../../../../../src/components/BallLoader';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { RoomDetails, RoomPlayerSide, TurfListItem } from '@bfam/shared-types';
import { apiClient } from '../../../../../src/lib/apiClient';
import { colors } from '../../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../../src/components/ScreenContainer';
import { StatusBadge } from '../../../../../src/components/StatusBadge';
import { Button } from '../../../../../src/components/Button';
import { TextField } from '../../../../../src/components/TextField';
import { ChipSelect } from '../../../../../src/components/ChipSelect';
import { useAuthStore } from '../../../../../src/store/authStore';

const SIDE_LABEL: Record<RoomPlayerSide, string> = {
  UNASSIGNED: 'Unassigned',
  TEAM_A: 'Team A',
  TEAM_B: 'Team B',
};
const NEXT_SIDE: Record<RoomPlayerSide, RoomPlayerSide> = {
  UNASSIGNED: 'TEAM_A',
  TEAM_A: 'TEAM_B',
  TEAM_B: 'UNASSIGNED',
};
const DURATION_OPTIONS = ['60', '90', '120'];
const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CAPTAIN_PAYS', label: 'Captain Pays' },
  { value: 'SPLIT_PAYMENT', label: 'Split' },
] as const;

// Backlog B-11: the room lobby — roster, captain-only side-split (manual
// tap-to-cycle or random shuffle, freely editable before starting per
// product decision), and the "book a turf, convert to a real match" step.
// From there it hands off entirely to the already-built Match Intro
// sequence (countdown → Playing XI reveal → toss), unchanged.
export default function RoomLobbyScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const user = useAuthStore((s) => s.user);

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [myBfamId, setMyBfamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showBooking, setShowBooking] = useState(false);
  const [turfs, setTurfs] = useState<TurfListItem[]>([]);
  const [turfId, setTurfId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [paymentMode, setPaymentMode] = useState<(typeof PAYMENT_MODES)[number]['value']>('CASH');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([apiClient.getRoomDetails(roomId), apiClient.getMyProfile()])
      .then(([roomRes, profileRes]) => {
        setRoom(roomRes);
        setMyBfamId(profileRes.bfam_id);
      })
      .catch(() => setError('Could not load this room.'))
      .finally(() => setLoading(false));
  }, [roomId]);

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
    } catch {
      setError('That action could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !room) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <BallLoader testID="room-lobby-loading" />
        </View>
      </ScreenContainer>
    );
  }

  const isCaptain = user?.user_id === room.captain_user_id;
  const myMembership = room.players.find((p) => p.bfam_id === myBfamId);
  const isMember = Boolean(myMembership);
  const everyoneAssigned = room.players.every((p) => p.side !== 'UNASSIGNED');

  if (room.room_status === 'CONVERTED' && room.match_id) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-4" testID="room-converted-state">
          <Feather name="check-circle" size={48} color={colors.brandRed} />
          <Text className="font-ui font-bold text-title-lg text-ink-black text-center mt-4">
            This room became a match!
          </Text>
          <View className="mt-6 w-full">
            <Button
              label="Go to Game Room"
              onPress={() => router.replace(`/(tabs)/matches/${room.match_id}`)}
              testID="go-to-game-room"
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (room.room_status === 'CANCELLED') {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-4" testID="room-cancelled-state">
          <Feather name="x-circle" size={48} color={colors.textTertiary} />
          <Text className="font-ui text-body text-text-secondary text-center mt-4">
            This room was cancelled.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View className="pt-6 pb-10" testID="room-lobby-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black">{room.room_name}</Text>
        <Text className="font-ui text-body text-text-secondary mt-1 mb-6">
          {room.players.length}/{room.max_players} players · {room.overs_per_innings} overs ·{' '}
          {room.ball_type === 'HARD_TENNIS' ? 'Hard Tennis' : 'Tennis'}
        </Text>

        {!isMember && room.room_status === 'FILLING' && (
          <View className="mb-6">
            <Button
              label="Join Room"
              onPress={() => withBusy(async () => setRoom(await apiClient.joinRoom(roomId)))}
              loading={busy}
              testID="join-room-button"
            />
          </View>
        )}

        <Text className="font-ui text-micro font-bold text-text-tertiary mb-3">ROSTER</Text>
        {room.players.map((p) => (
          <Pressable
            key={p.room_player_id}
            disabled={!isCaptain || busy}
            onPress={() =>
              withBusy(async () =>
                setRoom(
                  await apiClient.assignRoomSides(roomId, [
                    { player_id: p.player_id, side: NEXT_SIDE[p.side] },
                  ]),
                ),
              )
            }
            className="flex-row items-center justify-between bg-surface rounded-lg border border-border-subtle p-4 mb-2"
            testID={`room-player-${p.player_id}`}
          >
            <View className="flex-row items-center flex-1">
              <Text className="font-ui text-body text-ink-black flex-1" numberOfLines={1}>
                {p.full_name ?? p.bfam_id}
              </Text>
              {Boolean(p.is_captain) && (
                <View className="mr-2">
                  <StatusBadge label="Captain" variant="warning" />
                </View>
              )}
            </View>
            <View
              className={[
                'rounded-full px-3 py-1',
                p.side === 'UNASSIGNED' ? 'bg-surface-alt' : 'bg-brand-red',
              ].join(' ')}
            >
              <Text
                className={[
                  'font-ui text-micro font-bold',
                  p.side === 'UNASSIGNED' ? 'text-text-secondary' : 'text-white',
                ].join(' ')}
              >
                {SIDE_LABEL[p.side]}
              </Text>
            </View>
          </Pressable>
        ))}

        {isMember && !isCaptain && room.room_status === 'FILLING' && (
          <View className="mt-4">
            <Button
              label="Leave Room"
              variant="secondary"
              onPress={() =>
                withBusy(async () => {
                  await apiClient.leaveRoom(roomId);
                  router.back();
                })
              }
              loading={busy}
              testID="leave-room-button"
            />
          </View>
        )}

        {isCaptain && (
          <>
            <View className="mt-4">
              <Button
                label="Randomly Split into Two Sides"
                variant="secondary"
                iconLeft={<Feather name="shuffle" size={16} color="#D80000" />}
                onPress={() =>
                  withBusy(async () => setRoom(await apiClient.randomSplitRoom(roomId)))
                }
                loading={busy}
                testID="random-split-button"
              />
            </View>
            <Text className="font-ui text-micro text-text-tertiary mt-2 mb-6">
              Tap a player above to change their side by hand — the split stays editable right up
              until you start the match.
            </Text>

            {!showBooking ? (
              <Button
                label="Start Match"
                onPress={() => {
                  setError(null);
                  if (room.players.length < 2) {
                    setError('A room needs at least 2 players before it can start a match.');
                    return;
                  }
                  if (!everyoneAssigned) {
                    setError('Every player must be assigned a side before starting.');
                    return;
                  }
                  setShowBooking(true);
                  apiClient
                    .getTurfs({})
                    .then((res) => {
                      setTurfs(res.results);
                      setTurfId(res.results[0]?.turf_id ?? null);
                    })
                    .catch(() => setTurfs([]));
                }}
                testID="reveal-start-match"
              />
            ) : (
              <View testID="room-booking-form">
                <Text className="font-ui font-bold text-card-title text-ink-black mb-3">
                  Book a Turf
                </Text>
                {turfs.length > 0 && (
                  <ChipSelect
                    label="Turf"
                    options={turfs.map((t) => ({ value: t.turf_id, label: t.turf_name }))}
                    value={turfId}
                    onChange={setTurfId}
                    testID="room-turf-select"
                  />
                )}
                <TextField
                  label="Booking Date (YYYY-MM-DD)"
                  value={bookingDate}
                  onChangeText={setBookingDate}
                  placeholder="2026-10-01"
                  testID="room-booking-date"
                />
                <TextField
                  label="Start Time (HH:MM)"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="18:00"
                  testID="room-start-time"
                />
                <ChipSelect
                  label="Duration (minutes)"
                  options={DURATION_OPTIONS.map((v) => ({ value: v, label: v }))}
                  value={durationMinutes}
                  onChange={setDurationMinutes}
                  testID="room-duration"
                />
                <ChipSelect
                  label="Payment"
                  options={PAYMENT_MODES.map((m) => ({ value: m.value, label: m.label }))}
                  value={paymentMode}
                  onChange={(v) => setPaymentMode(v as typeof paymentMode)}
                  testID="room-payment-mode"
                />

                <Button
                  label="Confirm & Start Match"
                  onPress={() =>
                    withBusy(async () => {
                      if (!turfId || !bookingDate.trim() || !startTime.trim()) {
                        throw new Error('Fill in every booking field.');
                      }
                      const result = await apiClient.convertRoomToMatch(roomId, {
                        turf_id: turfId,
                        booking_date: bookingDate.trim(),
                        start_time: startTime.trim(),
                        duration_minutes: Number(durationMinutes),
                        payment_mode: paymentMode,
                      });
                      router.replace(`/(tabs)/matches/${result.match_id}`);
                    })
                  }
                  loading={busy}
                  testID="confirm-convert-room"
                />
              </View>
            )}
          </>
        )}

        {error && <Text className="font-ui text-body text-brand-red-dark mt-4">{error}</Text>}
      </View>
    </ScreenContainer>
  );
}
