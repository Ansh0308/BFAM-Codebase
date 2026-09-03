import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { GameRoom } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';

// Player Check-in (module 2.12, PRD §8.3/§8.4 "Check-In"): the
// organizer/staff-facing roster view for manually marking arrivals —
// distinct from check-in.tsx's QR display, which is the *player's*
// self-check-in surface. Calls the same POST /matches/:matchId/attendance/
// :playerId route module 2.6 already built; a TURF_STAFF caller is gated
// by the staff-verification check inside setPlayerAttendance (PRD §32.14)
// — an unverified staff member sees that as the error below, same as any
// other rejection.
export default function RosterCheckInScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getGameRoom(matchId)
      .then(setRoom)
      .catch(() => setRoom(null))
      .finally(() => setLoading(false));
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function checkIn(playerId: string) {
    setBusyPlayerId(playerId);
    setError(null);
    try {
      await apiClient.setPlayerAttendance(matchId, playerId, 'CHECKED_IN');
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not check this player in.');
    } finally {
      setBusyPlayerId(null);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            testID="roster-check-in-loading"
          />
        </View>
      </ScreenContainer>
    );
  }

  if (!room) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="roster-check-in-error">
          <Text className="font-ui text-body text-text-secondary text-center">
            Could not load this match&apos;s roster.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const confirmedPlayers = room.players.filter((p) => p.invitation_status === 'CONFIRMED');

  return (
    <ScreenContainer>
      <View className="pt-6 flex-1" testID="roster-check-in-screen">
        <View className="flex-row items-center px-1 mb-4">
          <Pressable onPress={() => router.back()} hitSlop={8} testID="roster-check-in-back">
            <Feather name="arrow-left" size={22} color="#0D0D0D" />
          </Pressable>
          <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">
            Player Check-In
          </Text>
        </View>

        {error && (
          <Text className="text-brand-red text-body mb-3" testID="roster-check-in-error-message">
            {error}
          </Text>
        )}

        <FlatList
          data={confirmedPlayers}
          keyExtractor={(p) => p.player_id}
          testID="roster-check-in-list"
          renderItem={({ item }) => {
            const checkedIn = item.attendance_status === 'CHECKED_IN';
            return (
              <View className="flex-row items-center justify-between py-3 border-b border-border-subtle">
                <View>
                  <Text className="font-ui font-semibold text-body text-text-primary">
                    {item.bfam_id}
                  </Text>
                  <Text className="font-ui text-micro text-text-tertiary mt-0.5">
                    {item.attendance_status.replace('_', ' ')}
                  </Text>
                </View>
                {checkedIn ? (
                  <View className="flex-row items-center" testID={`checked-in-${item.player_id}`}>
                    <Feather name="check-circle" size={18} color="#D80000" />
                    <Text className="font-ui text-body text-brand-red ml-2">Checked In</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => checkIn(item.player_id)}
                    disabled={busyPlayerId === item.player_id}
                    className="rounded-md border border-brand-red px-4 py-2"
                    testID={`check-in-button-${item.player_id}`}
                  >
                    {busyPlayerId === item.player_id ? (
                      <ActivityIndicator size="small" color={colors.brandRed} />
                    ) : (
                      <Text className="font-ui font-bold text-micro uppercase text-brand-red">
                        Check In
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text className="font-ui text-body text-text-tertiary text-center mt-8">
              No confirmed players yet.
            </Text>
          }
        />
      </View>
    </ScreenContainer>
  );
}
