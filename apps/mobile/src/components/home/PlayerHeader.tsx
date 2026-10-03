import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { BrandLogo } from '../BrandLogo';
import { CountUp } from './CountUp';
import { NotificationDot } from './HomeParts';
import { CoinsInfoSheet } from '../coins/CoinsInfoSheet';

// The player-side top bar shared by Home and Matches: BFAM wordmark, BFAM
// Points, search, notifications (with the unread dot), profile. The points
// pill is hidden for accounts with no balance (non-player roles); tapping it
// explains what the coins are, how to earn them and what they are for.
export function PlayerHeader({
  points,
  unreadCount,
}: {
  points: number | null | undefined;
  unreadCount: number;
}) {
  const router = useRouter();
  const [coinsInfoOpen, setCoinsInfoOpen] = useState(false);
  return (
    <View className="flex-row items-center justify-between pt-3" testID="player-header">
      <BrandLogo variant="horizontal" height={34} />

      <View className="flex-row items-center">
        {points !== null && points !== undefined && (
          <Pressable
            onPress={() => setCoinsInfoOpen(true)}
            className="flex-row items-center bg-surface-alt rounded-full px-2.5 py-1.5 mr-3"
            testID="home-coin-balance"
            accessibilityRole="button"
            accessibilityLabel={`${points} BFAM points`}
            accessibilityHint="Shows what BFAM coins are and how to use them"
          >
            <MaterialCommunityIcons name="trophy" size={16} color={colors.brandRed} />
            <CountUp
              value={points}
              className="font-ui font-bold text-ink-black ml-1.5"
              style={{ fontSize: 15 }}
            />
            <Feather name="info" size={13} color={colors.textTertiary} style={{ marginLeft: 6 }} />
          </Pressable>
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
      <CoinsInfoSheet
        visible={coinsInfoOpen}
        balance={points ?? 0}
        onClose={() => setCoinsInfoOpen(false)}
      />
    </View>
  );
}
