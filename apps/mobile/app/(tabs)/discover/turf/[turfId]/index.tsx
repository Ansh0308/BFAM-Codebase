import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TurfDetails } from '@bfam/shared-types';
import { apiClient } from '../../../../../src/lib/apiClient';
import { colors } from '../../../../../src/theme/tokens';

// Turf Details: full-bleed hero + facilities icon row + availability slot
// grid preview, following Design §3.3's pattern exactly.
export default function TurfDetailsScreen() {
  const { turfId } = useLocalSearchParams<{ turfId: string }>();
  const router = useRouter();
  const [details, setDetails] = useState<TurfDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .getTurfDetails(turfId)
      .then((data) => {
        if (!cancelled) setDetails(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this turf. Please go back and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [turfId]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.brandRed} testID="turf-details-loading" />
      </SafeAreaView>
    );
  }

  if (error || !details) {
    return (
      <SafeAreaView
        className="flex-1 bg-surface items-center justify-center px-6"
        edges={['bottom']}
      >
        <Text className="text-text-secondary text-body text-center">
          {error ?? 'Turf not found.'}
        </Text>
      </SafeAreaView>
    );
  }

  const heroImage = details.images[0]?.image_url;

  return (
    <ScrollView className="flex-1 bg-surface" testID="turf-details-screen">
      {/* Full-bleed hero — edge-to-edge photo, no card padding (Design §3.3) */}
      <View className="w-full h-56 bg-surface-alt">
        {heroImage ? (
          <Image source={{ uri: heroImage }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-text-tertiary text-body">NO PHOTOS AVAILABLE</Text>
          </View>
        )}
      </View>

      <View className="px-6 pt-5">
        <Text className="font-ui font-bold text-title-xl text-ink-black">{details.turf_name}</Text>
        <Text className="text-text-secondary text-body mt-1">
          {details.address_line}, {details.city}
        </Text>

        {details.average_rating != null && (
          <Text className="text-rating-star text-body mt-1">
            ★ {details.average_rating.toFixed(1)}
          </Text>
        )}

        {/* Facilities icon row */}
        {details.facilities.length > 0 && (
          <View className="flex-row flex-wrap mt-4">
            {details.facilities.map((f) => (
              <View
                key={f.facility_id}
                className="bg-surface-alt rounded-sm px-3 py-1 mr-2 mb-2 border border-border-subtle"
              >
                <Text className="text-text-secondary text-micro uppercase">{f.facility_name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pricing */}
        {details.pricing.length > 0 && (
          <View className="mt-4">
            <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
              Pricing
            </Text>
            {details.pricing.map((p) => (
              <Text key={p.pricing_id} className="text-text-primary text-body">
                {p.day_type}: {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)} · ₹
                {p.price_per_hour}/hr
              </Text>
            ))}
          </View>
        )}

        {/* Availability preview slot grid (Design §3.3) */}
        <View className="mt-5 mb-8">
          <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
            Availability Today
          </Text>
          {details.availability_preview && details.availability_preview.slots.length > 0 ? (
            <View className="flex-row flex-wrap">
              {details.availability_preview.slots.map((slot) => {
                const isAvailable = slot.status === 'AVAILABLE';
                return (
                  <View
                    key={slot.start_time}
                    className={`rounded-sm px-3 py-2 mr-2 mb-2 border border-border-subtle ${
                      isAvailable ? 'bg-surface' : 'bg-disabled-surface'
                    }`}
                  >
                    <Text
                      className={`text-micro ${isAvailable ? 'text-brand-red' : 'text-text-tertiary'}`}
                    >
                      {slot.start_time.slice(0, 5)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text className="text-text-tertiary text-body">No slots available today.</Text>
          )}

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(tabs)/discover/turf/[turfId]/availability',
                params: { turfId, turfName: details.turf_name },
              })
            }
            className="mt-3 bg-surface border border-border-strong rounded-md py-3 items-center"
            testID="view-full-availability-button"
          >
            <Text className="font-ui font-bold text-text-primary text-button">
              View Full Availability
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(tabs)/discover/turf/[turfId]/availability',
              params: { turfId, turfName: details.turf_name },
            })
          }
          className="bg-brand-red rounded-md py-4 items-center mb-8"
          testID="book-this-turf-button"
        >
          <Text className="font-ui font-bold text-surface text-button uppercase">
            Book This Turf
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
