import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import type { HomeBanner } from '@bfam/shared-types';
import { apiClient } from '../lib/apiClient';

const BANNER_HEIGHT = 160;

// Home Page Carousel (backlog B-6): active promotional banners, in
// display order. Renders nothing at all when there are none — this is
// meant to be an optional strip above the rest of Home, not a placeholder
// that takes up space with nothing in it.
//
// Wrapped in a plain View with an explicit height rather than sizing the
// ScrollView itself: React Native Web's horizontal ScrollView overwrites
// any inline height set directly on it with its own (wrong) computed
// value — the same issue already worked around for Discover's "Near You"
// row (module 2.3) — so the height has to live on a wrapper the
// ScrollView's own layout pass doesn't touch.
export function HomeBannerCarousel() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);

  useEffect(() => {
    apiClient
      .getHomeBanners()
      .then((res) => setBanners(res.results))
      .catch(() => setBanners([]));
  }, []);

  if (banners.length === 0) return null;

  return (
    <View className="mb-6" style={{ height: BANNER_HEIGHT }} testID="home-banner-carousel">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'flex-start' }}
      >
        {banners.map((banner) => (
          <Pressable
            key={banner.banner_id}
            onPress={() => banner.link_url && Linking.openURL(banner.link_url)}
            disabled={!banner.link_url}
            className="mr-3 rounded-lg overflow-hidden"
            style={{ width: 280, height: BANNER_HEIGHT }}
            testID={`home-banner-${banner.banner_id}`}
            accessibilityLabel={banner.title}
          >
            <Image
              source={{ uri: banner.image_url }}
              style={{ width: 280, height: BANNER_HEIGHT }}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
