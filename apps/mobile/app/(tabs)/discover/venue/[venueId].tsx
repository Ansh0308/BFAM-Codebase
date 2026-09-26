import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { BallLoader } from '../../../../src/components/BallLoader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PublicVenueDetails } from '@bfam/shared-types';
import { apiClient } from '../../../../src/lib/apiClient';

// Venue pitch picker (feedback backlog A-2/follow-up) — reached from a
// grouped Discover card. Each pitch is its own fully independent turf with
// its own availability/booking, so tapping one just opens the normal Turf
// Details screen unchanged.
export default function VenuePitchPickerScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const router = useRouter();
  const [venue, setVenue] = useState<PublicVenueDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .getVenueDetails(venueId)
      .then((data) => {
        if (!cancelled) setVenue(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this venue. Please go back and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['bottom']}>
        <BallLoader testID="venue-picker-loading" />
      </SafeAreaView>
    );
  }

  if (error || !venue) {
    return (
      <SafeAreaView
        className="flex-1 bg-surface items-center justify-center px-6"
        edges={['bottom']}
      >
        <Text
          className="font-ui text-body text-text-secondary text-center"
          testID="venue-picker-error"
        >
          {error ?? 'Venue not found.'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <View className="px-5 pt-6 pb-2">
        <Text
          className="font-ui font-bold text-title-xl text-ink-black"
          testID="venue-picker-title"
        >
          {venue.venue_name}
        </Text>
        <Text className="font-ui text-body text-text-secondary mt-1">
          {venue.address_line}, {venue.city}
        </Text>
        <Text className="font-ui text-micro text-text-tertiary mt-3">
          Choose a pitch — each has its own availability and booking.
        </Text>
      </View>

      <View className="px-5 pt-4">
        {venue.turfs.length === 0 ? (
          <Text className="font-ui text-body text-text-tertiary mt-4" testID="venue-picker-empty">
            No pitches are available at this venue right now.
          </Text>
        ) : (
          venue.turfs.map((pitch) => (
            <Pressable
              key={pitch.turf_id}
              onPress={() => router.push(`/(tabs)/discover/turf/${pitch.turf_id}`)}
              className="flex-row items-center bg-surface-alt rounded-lg mb-3 overflow-hidden"
              testID={`venue-pitch-card-${pitch.turf_id}`}
            >
              {pitch.cover_image_url ? (
                <Image
                  source={{ uri: pitch.cover_image_url }}
                  className="w-20 h-20"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-20 h-20 bg-surface items-center justify-center">
                  <Text className="text-text-tertiary text-micro">NO PHOTO</Text>
                </View>
              )}
              <View className="flex-1 px-3">
                <Text className="font-ui font-semibold text-body text-ink-black">
                  {pitch.turf_name}
                </Text>
                <Text className="text-brand-red font-ui text-micro mt-1">
                  {pitch.min_price_per_hour !== null
                    ? `₹${pitch.min_price_per_hour}/hr`
                    : 'Pricing unavailable'}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}
