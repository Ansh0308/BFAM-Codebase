import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { OpenRoom } from '@bfam/shared-types';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';

// Backlog B-11: discovery surface for open rooms, parallel to Open Teams
// (app/(tabs)/teams/open.tsx) but for a one-off game lobby instead of a
// persistent team.
export default function OpenRoomsScreen() {
  const router = useRouter();
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getOpenRooms()
      .then((res) => setRooms(res.results))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScreenContainer>
      <View className="pt-6 flex-1" testID="open-rooms-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black mb-1">Find a Room</Text>
        <Text className="font-ui text-body text-text-secondary mb-4">
          Join a lobby other players are assembling, or start your own.
        </Text>

        <View className="mb-6">
          <Button
            label="Create a Room"
            iconLeft={<Feather name="plus" size={16} color="#FFFFFF" />}
            onPress={() => router.push('/(tabs)/matches/rooms/create')}
            testID="create-room-button"
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.brandRed} testID="open-rooms-loading" />
        ) : rooms.length === 0 ? (
          <View className="items-center mt-8">
            <View
              className="rounded-full bg-surface-alt items-center justify-center mb-4"
              style={{ width: 64, height: 64 }}
            >
              <Feather name="users" size={26} color="#9A9A9A" />
            </View>
            <Text className="font-ui text-body text-text-secondary text-center">
              No open rooms right now — start one.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.room_id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(tabs)/matches/rooms/${item.room_id}`)}
                className="flex-row items-center bg-surface rounded-lg border border-border-subtle p-4 mb-3"
                testID={`room-row-${item.room_id}`}
              >
                <View
                  className="rounded-full bg-surface-alt items-center justify-center mr-4"
                  style={{ width: 48, height: 48 }}
                >
                  <Feather name="users" size={20} color="#D80000" />
                </View>
                <View className="flex-1">
                  <Text
                    className="font-ui font-semibold text-card-title text-ink-black"
                    numberOfLines={1}
                  >
                    {item.room_name}
                  </Text>
                  <Text className="text-text-secondary text-body mt-0.5">
                    {item.player_count}/{item.max_players} players · {item.overs_per_innings} overs
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#9A9A9A" />
              </Pressable>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
