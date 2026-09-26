import React, { useCallback, useRef, useState } from 'react';
import { Animated, Platform, Text, View, useWindowDimensions } from 'react-native';
import { BallLoader } from '../../../../src/components/BallLoader';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import type { OpenRoom } from '@bfam/shared-types';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { Reveal } from '../../../../src/components/Reveal';
import { ScreenHeader } from '../../../../src/components/ScreenHeader';
import {
  CreateRoomButton,
  EmptyRooms,
  RoomCard,
} from '../../../../src/components/rooms/RoomsParts';
import heroArt from '../../../../src/assets/images/matches-bg.jpg';

const HERO_ART_HEIGHT = 470;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Backlog B-11: discovery surface for open rooms, parallel to Open Teams
// (app/(tabs)/teams/open.tsx) but for a one-off game lobby instead of a
// persistent team. Presentation-only redesign: the same list, the same
// Create a Room action, the same tap-a-room-to-open-it navigation.
export default function OpenRoomsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

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

  const artShift = scrollY.interpolate({
    inputRange: [0, 400],
    outputRange: [0, -60],
    extrapolate: 'clamp',
  });

  const header = (
    <View testID="open-rooms-header">
      <ScreenHeader title="Find a Room" />

      <View style={{ marginTop: 26 }}>
        <Reveal delay={40}>
          <Text
            className="font-ui text-text-secondary"
            style={{ fontSize: 11, letterSpacing: 3.2 }}
          >
            JOIN • PLAY • COMPETE
          </Text>
        </Reveal>
        <MotiView
          from={{ width: 0 }}
          animate={{ width: 44 }}
          transition={{ type: 'timing', duration: 450, delay: 160 }}
          style={{ height: 3, borderRadius: 2, backgroundColor: colors.brandRed, marginTop: 12 }}
        />
        <Reveal delay={140}>
          <Text
            className="font-display text-ink-black"
            style={{
              fontSize: 64,
              lineHeight: 66,
              marginTop: 14,
              transform: [{ skewX: '-8deg' }],
            }}
          >
            FIND A
          </Text>
          <Text
            className="font-display text-brand-red"
            style={{ fontSize: 64, lineHeight: 66, transform: [{ skewX: '-8deg' }] }}
          >
            ROOM
          </Text>
        </Reveal>
        <Reveal delay={260}>
          <Text
            className="font-ui text-ink-black"
            style={{ fontSize: 15, lineHeight: 23, marginTop: 14, maxWidth: '68%' }}
          >
            Join a lobby other players are assembling, or start your own.
          </Text>
        </Reveal>
      </View>

      <View style={{ marginTop: 26, marginBottom: 30 }}>
        <CreateRoomButton onPress={() => router.push('/(tabs)/matches/rooms/create')} />
      </View>

      {!loading && rooms.length > 0 && (
        <View className="flex-row items-end justify-between" style={{ marginBottom: 14 }}>
          <Text
            className="font-ui font-bold text-ink-black"
            style={{ fontSize: 15, letterSpacing: 2 }}
          >
            OPEN ROOMS
          </Text>
          <Text className="font-ui text-text-secondary" style={{ fontSize: 13 }}>
            {rooms.length} {rooms.length === 1 ? 'Room' : 'Rooms'}
          </Text>
        </View>
      )}
    </View>
  );

  const empty = loading ? (
    <BallLoader testID="open-rooms-loading" style={{ marginTop: 24 }} />
  ) : (
    <EmptyRooms />
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="open-rooms-screen">
      {/* Campaign art at the top only, fading into the white page: batter on
          the right, the left kept clear for the headline. No opacity
          animation on the image itself, so it can't get stuck half-visible. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HERO_ART_HEIGHT,
          transform: [{ translateY: artShift }],
        }}
      >
        <MotiView
          from={{ translateX: 14 }}
          animate={{ translateX: 0 }}
          transition={{ type: 'timing', duration: 900 }}
          style={{ width, height: HERO_ART_HEIGHT }}
        >
          <Image
            source={heroArt}
            style={{ width: '100%', height: HERO_ART_HEIGHT }}
            contentFit="cover"
            contentPosition="right top"
            accessibilityElementsHidden
          />
        </MotiView>
        <LinearGradient
          colors={['rgba(255,255,255,0)', '#FFFFFF']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 170 }}
        />
      </Animated.View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <Animated.FlatList
          data={loading ? [] : rooms}
          keyExtractor={(item) => (item as OpenRoom).room_id}
          renderItem={({ item, index }) => {
            const room = item as OpenRoom;
            return (
              <RoomCard
                room={room}
                index={index}
                onPress={() => router.push(`/(tabs)/matches/rooms/${room.room_id}`)}
              />
            );
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: USE_NATIVE_DRIVER,
          })}
        />
      </SafeAreaView>
    </View>
  );
}
