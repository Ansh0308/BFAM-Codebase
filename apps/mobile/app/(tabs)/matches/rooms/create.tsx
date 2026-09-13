import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { MatchBallType } from '@bfam/shared-types';
import { apiClient } from '../../../../src/lib/apiClient';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { ChipSelect } from '../../../../src/components/ChipSelect';

const BALL_TYPES: { value: MatchBallType; label: string }[] = [
  { value: 'TENNIS', label: 'Tennis' },
  { value: 'HARD_TENNIS', label: 'Hard Tennis' },
];
const OVERS_OPTIONS = ['5', '6', '8', '10', '15', '20'];
const MAX_PLAYERS_OPTIONS = ['6', '10', '12', '16', '22'];

// Backlog B-11: open a room. The captain fills in the format up front
// (same fields Create Match asks for) — the roster and side-split happen
// afterward, in the room lobby, before a turf is ever booked.
export default function CreateRoomScreen() {
  const router = useRouter();
  const [roomName, setRoomName] = useState('');
  const [ballType, setBallType] = useState<MatchBallType>('TENNIS');
  const [oversPerInnings, setOversPerInnings] = useState('8');
  const [maxPlayers, setMaxPlayers] = useState('12');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!roomName.trim()) {
      setError('Give your room a name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const room = await apiClient.createRoom({
        room_name: roomName.trim(),
        ball_type: ballType,
        overs_per_innings: Number(oversPerInnings),
        max_players: Number(maxPlayers),
      });
      router.replace(`/(tabs)/matches/rooms/${room.room_id}`);
    } catch {
      setError('Could not create the room. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <View className="pt-6" testID="create-room-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black mb-4">Create a Room</Text>

        <TextField
          label="Room Name"
          value={roomName}
          onChangeText={setRoomName}
          placeholder="e.g. Friday Night Lights"
          testID="room-name-input"
        />

        <ChipSelect
          label="Ball Type"
          options={BALL_TYPES}
          value={ballType}
          onChange={(v) => setBallType(v as MatchBallType)}
          testID="room-ball-type"
        />
        <ChipSelect
          label="Overs per Innings"
          options={OVERS_OPTIONS.map((v) => ({ value: v, label: v }))}
          value={oversPerInnings}
          onChange={setOversPerInnings}
          testID="room-overs"
        />
        <ChipSelect
          label="Max Players"
          options={MAX_PLAYERS_OPTIONS.map((v) => ({ value: v, label: v }))}
          value={maxPlayers}
          onChange={setMaxPlayers}
          testID="room-max-players"
        />

        {error && <Text className="font-ui text-body text-brand-red-dark mb-4">{error}</Text>}

        <Button
          label="Create Room"
          onPress={submit}
          loading={submitting}
          testID="submit-create-room"
        />
      </View>
    </ScreenContainer>
  );
}
