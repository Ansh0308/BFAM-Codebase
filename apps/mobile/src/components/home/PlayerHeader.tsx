import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { BrandLogo } from '../BrandLogo';
import { CountUp } from './CountUp';
import { NotificationDot } from './HomeParts';

// The player-side top bar shared by Home and Matches: BFAM wordmark, BFAM
// Points, search, notifications (with the unread dot), profile. The points
// pill is hidden for accounts with no balance (non-player roles).
export function PlayerHeader({
  points,
  unreadCount,
}: {
  points: number | null | undefined;
  unreadCount: number;
}) {
  const router = useRouter();
  return (
    <View className="flex-row items-center justify-between pt-3" testID="player-header">
      <BrandLogo variant="horizontal" height={34} />

      <View className="flex-row items-center">
        {points !== null && points !== undefined && (
          <View
            className="flex-row items-center bg-surface-alt rounded-full px-2.5 py-1.5 mr-3"
            testID="home-coin-balance"
            accessibilityLabel={`${points} BFAM points`}
          >
            <MaterialCommunityIcons name="trophy" size={16} color={colors.brandRed} />
            <CountUp
              value={points}
              className="font-ui font-bold text-ink-black ml-1.5"
              style={{ fontSize: 15 }}
            />
          </View>
        )}
        <Pressable
          onPress={() => router.push('/player-search')}
          hitSlop={8}
          accessibilityLabel="Find a player"
          testID="home-search-button"
          className="mr-3"
        >
          <Feather name="search" size={22} color={colors.inkBlack} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/notifications')}
          hitSlop={8}
          accessibilityLabel="Notifications"
          testID="home-notifications-button"
          className="mr-3"
        >
          <View>
            <Feather name="bell" size={22} color={colors.inkBlack} />
            {unreadCount > 0 && <NotificationDot />}
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityLabel="Your profile"
          testID="home-profile-avatar"
        >
          <View
            className="rounded-full bg-brand-red items-center justify-center"
            style={{ width: 36, height: 36 }}
          >
            <Feather name="user" size={18} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}
