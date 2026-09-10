import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

interface Props {
  venueId: string;
  venueName: string;
  city: string;
  coverImageUrl: string | null;
  minPricePerHour: number | null;
  distanceKm: number | null;
  pitchCount: number;
  onPress: () => void;
  variant?: 'vertical' | 'horizontal';
}

// Discover card for a venue with more than one pitch (feedback backlog
// A-2/follow-up) — one card per venue instead of one per pitch, so a
// player sees "Redline Sports Complex · 3 pitches" and picks a pitch on
// the next screen rather than seeing unrelated-looking duplicate cards.
// Same visual language as TurfCard.
export function VenueCard({
  venueId,
  venueName,
  city,
  coverImageUrl,
  minPricePerHour,
  distanceKm,
  pitchCount,
  onPress,
  variant = 'vertical',
}: Props) {
  const isHorizontal = variant === 'horizontal';

  return (
    <Pressable
      onPress={onPress}
      className={`bg-surface rounded-lg border border-border-subtle overflow-hidden ${
        isHorizontal ? 'w-[220px] mr-3' : 'mb-4'
      }`}
      testID={`venue-card-${venueId}`}
    >
      {coverImageUrl ? (
        <Image source={{ uri: coverImageUrl }} className="w-full h-32" resizeMode="cover" />
      ) : (
        <View className="w-full h-32 bg-surface-alt items-center justify-center">
          <Text className="text-text-tertiary text-micro">NO PHOTO</Text>
        </View>
      )}
      <View className="p-3">
        <Text className="font-ui font-semibold text-card-title text-ink-black" numberOfLines={1}>
          {venueName}
        </Text>
        <Text className="text-text-secondary text-body mt-1" numberOfLines={1}>
          {city} · {pitchCount} pitch{pitchCount === 1 ? '' : 'es'}
        </Text>
        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-brand-red font-ui text-button">
            {minPricePerHour !== null ? `From ₹${minPricePerHour}/hr` : 'Pricing unavailable'}
          </Text>
        </View>
        {distanceKm !== null && (
          <Text className="text-text-tertiary text-micro mt-1">
            {distanceKm < 1
              ? `${Math.round(distanceKm * 1000)} m away`
              : `${distanceKm.toFixed(1)} km away`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
