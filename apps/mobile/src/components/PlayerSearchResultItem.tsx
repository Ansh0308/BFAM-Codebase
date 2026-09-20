import React from 'react';
import { Pressable, Text, View, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PlayerSearchResult } from '@bfam/shared-types';

const PLAYING_ROLE_LABELS: Record<string, string> = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-Rounder',
  WICKET_KEEPER: 'Wicket-Keeper',
};

interface PlayerSearchResultItemProps {
  player: PlayerSearchResult;
  onPress: () => void;
  testID?: string;
}

// Backlog B-12: a search result row, styled the same as
// CricketerSearchResultItem (48px avatar, bold name, red chevron) — the
// secondary line trades that component's fixed "attribution" caption for
// whatever identifies this specific player: BFAM ID plus city/role when set.
export function PlayerSearchResultItem({ player, onPress, testID }: PlayerSearchResultItemProps) {
  const secondaryParts = [
    player.playing_role ? PLAYING_ROLE_LABELS[player.playing_role] : null,
    player.city,
  ].filter(Boolean);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center py-3 border-b border-border-subtle"
      style={{ minHeight: 44 }}
    >
      {player.profile_photo_url ? (
        <Image
          source={{ uri: player.profile_photo_url }}
          className="rounded-full mr-4"
          style={{ width: 48, height: 48 }}
        />
      ) : (
        <View
          className="rounded-full mr-4 bg-disabled-surface items-center justify-center"
          style={{ width: 48, height: 48 }}
        >
          <Feather name="user" size={20} color="#9A9A9A" />
        </View>
      )}
      <View className="flex-1">
        <Text className="font-ui font-bold text-body text-text-primary" numberOfLines={1}>
          {player.full_name || player.bfam_id}
        </Text>
        <Text className="font-ui text-micro text-text-tertiary mt-0.5" numberOfLines={1}>
          {[player.bfam_id, ...secondaryParts].join(' · ')}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color="#D80000" />
    </Pressable>
  );
}
