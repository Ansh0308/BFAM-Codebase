import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { MotiView } from 'moti';
import type { OpenRoom } from '@bfam/shared-types';
import { colors } from '../../theme/tokens';
import { Reveal } from '../Reveal';
import emptyIllustration from '../../assets/images/rooms-empty.jpg';

// Primary action. Scales to 0.97 on press, the arrow slides right, the red
// brightens a touch and a soft white highlight sweeps across once — all in
// ~300ms, nothing flashy.
export function CreateRoomButton({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  const [sweep, setSweep] = useState(0);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 380, delay: 320 }}
    >
      <MotiView
        animate={{ scale: pressed ? 0.97 : 1 }}
        transition={{ type: 'timing', duration: 140 }}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            setPressed(true);
            setSweep((n) => n + 1);
          }}
          onPressOut={() => setPressed(false)}
          testID="create-room-button"
          accessibilityRole="button"
          accessibilityLabel="Create a room"
          className="flex-row items-center justify-center"
          style={{
            height: 56,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: pressed ? '#F0180C' : '#E10600',
            shadowColor: colors.brandRed,
            shadowOpacity: 0.28,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          {sweep > 0 && (
            <MotiView
              key={sweep}
              from={{ translateX: -120 }}
              animate={{ translateX: 460 }}
              transition={{ type: 'timing', duration: 420 }}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -10,
                bottom: -10,
                width: 70,
                backgroundColor: 'rgba(255,255,255,0.22)',
                transform: [{ skewX: '-20deg' }],
              }}
            />
          )}
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text
            className="font-ui font-bold text-white"
            style={{ fontSize: 16, letterSpacing: 0.8, marginLeft: 10 }}
          >
            CREATE A ROOM
          </Text>
          <MotiView
            animate={{ translateX: pressed ? 6 : 0 }}
            transition={{ type: 'timing', duration: 160 }}
            style={{ marginLeft: 10 }}
          >
            <Feather name="arrow-right" size={20} color="#FFFFFF" />
          </MotiView>
        </Pressable>
      </MotiView>
    </MotiView>
  );
}

// "● OPEN" normally, "● 1 SPOT LEFT" once a single seat remains — red either
// way, never green.
function statusText(room: OpenRoom): string {
  const left = room.max_players - Number(room.player_count);
  return left === 1 ? '1 SPOT LEFT' : 'OPEN';
}

export function RoomCard({
  room,
  index,
  onPress,
}: {
  room: OpenRoom;
  index: number;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const ballLabel = room.ball_type === 'HARD_TENNIS' ? 'HARD TENNIS' : 'TENNIS';

  return (
    <Reveal delay={120 + Math.min(index, 6) * 90} distance={12}>
      <MotiView
        animate={{ scale: pressed ? 0.985 : 1, translateY: pressed ? -2 : 0 }}
        transition={{ type: 'timing', duration: 150 }}
        style={{ marginBottom: 14 }}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          testID={`room-row-${room.room_id}`}
          accessibilityRole="button"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E8E8E8',
            paddingVertical: 16,
            paddingRight: 16,
            paddingLeft: 20,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: pressed ? 0.1 : 0.04,
            shadowRadius: pressed ? 14 : 10,
            shadowOffset: { width: 0, height: pressed ? 6 : 2 },
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              backgroundColor: colors.brandRed,
            }}
          />
          <View className="flex-row items-center justify-between">
            <Text
              className="font-ui font-bold text-ink-black flex-1"
              style={{ fontSize: 17, marginRight: 10 }}
              numberOfLines={1}
            >
              {room.room_name}
            </Text>
            <View className="flex-row items-center">
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colors.brandRed,
                  marginRight: 6,
                }}
              />
              <Text
                style={{
                  color: colors.brandRed,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1,
                }}
              >
                {statusText(room)}
              </Text>
            </View>
          </View>
          <Text
            className="font-ui font-bold text-ink-black"
            style={{ fontSize: 14, letterSpacing: 0.6, marginTop: 12 }}
          >
            {room.player_count} / {room.max_players} PLAYERS
          </Text>
          <Text
            className="font-ui text-text-secondary"
            style={{ fontSize: 12, letterSpacing: 0.8, marginTop: 4 }}
          >
            {room.overs_per_innings} OVERS • {ballLabel}
          </Text>
          <View className="flex-row items-center" style={{ marginTop: 14 }}>
            <Text
              style={{
                color: colors.brandRed,
                fontSize: 13,
                fontWeight: '700',
                letterSpacing: 1.2,
              }}
            >
              JOIN
            </Text>
            <MotiView
              animate={{ translateX: pressed ? 5 : 0 }}
              transition={{ type: 'timing', duration: 160 }}
              style={{ marginLeft: 6 }}
            >
              <Feather name="arrow-right" size={16} color={colors.brandRed} />
            </MotiView>
          </View>
        </Pressable>
      </MotiView>
    </Reveal>
  );
}

// Monochrome stumps + a single red ball on a faint stadium. The artwork rises
// and fades in as one piece; the copy follows a beat later. No bouncing.
export function EmptyRooms() {
  return (
    <View className="items-center" style={{ marginTop: 8 }} testID="open-rooms-empty">
      <MotiView
        from={{ opacity: 0, translateY: 14 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 700 }}
        style={{ width: '100%' }}
      >
        <Image
          source={emptyIllustration}
          style={{ width: '100%', aspectRatio: 850 / 453 }}
          contentFit="contain"
          accessibilityElementsHidden
        />
      </MotiView>
      <MotiView
        from={{ width: 0 }}
        animate={{ width: 44 }}
        transition={{ type: 'timing', duration: 500, delay: 500 }}
        style={{ height: 3, borderRadius: 2, backgroundColor: colors.brandRed, marginTop: 4 }}
      />
      <Reveal delay={600}>
        <Text
          className="font-display text-ink-black text-center"
          style={{ fontSize: 26, marginTop: 16 }}
        >
          NO OPEN ROOMS RIGHT NOW
        </Text>
        <Text
          className="font-ui text-text-secondary text-center"
          style={{ fontSize: 15, marginTop: 8 }}
        >
          Start a room and get players together!
        </Text>
      </Reveal>
    </View>
  );
}
