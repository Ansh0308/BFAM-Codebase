import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { TurfListItem } from '@bfam/shared-types';

interface Props {
  turf: TurfListItem;
  onPress: () => void;
  variant?: 'vertical' | 'horizontal';
}

// Turf Listing card — used both in the "Near You" horizontal scroll row and
// the main vertical results list (Design §3.3 grid patterns).
export function TurfCard({ turf, onPress, variant = 'vertical' }: Props) {
  const isHorizontal = variant === 'horizontal';

  return (
    <Pressable
      onPress={onPress}
      className={`bg-surface rounded-lg border border-border-subtle overflow-hidden ${
        isHorizontal ? 'w-[220px] mr-3' : 'mb-4'
      }`}
      testID={`turf-card-${turf.turf_id}`}
    >
      {turf.cover_image_url ? (
        <Image source={{ uri: turf.cover_image_url }} className="w-full h-32" resizeMode="cover" />
      ) : (
        <View className="w-full h-32 bg-surface-alt items-center justify-center">
          <Text className="text-text-tertiary text-micro">NO PHOTO</Text>
        </View>
      )}
      <View className="p-3">
        <Text className="font-ui font-semibold text-card-title text-ink-black" numberOfLines={1}>
          {turf.turf_name}
        </Text>
        <Text className="text-text-secondary text-body mt-1" numberOfLines={1}>
          {turf.city}
        </Text>
        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-brand-red font-ui text-button">
            {turf.min_price_per_hour !== null
              ? `₹${turf.min_price_per_hour}/hr`
              : 'Pricing unavailable'}
          </Text>
          {turf.average_rating !== null && (
            <Text className="text-rating-star text-body">★ {turf.average_rating.toFixed(1)}</Text>
          )}
        </View>
        {turf.distance_km !== null && (
          <Text className="text-text-tertiary text-micro mt-1">
            {turf.distance_km < 1
              ? `${Math.round(turf.distance_km * 1000)} m away`
              : `${turf.distance_km.toFixed(1)} km away`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
