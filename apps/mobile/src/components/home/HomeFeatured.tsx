import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { HomeFeatured as HomeFeaturedData } from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';

// "Featured" strip on Home (AW-13): announcements, offers, turfs and tournaments the admin picked.
// Renders nothing until there is something to show, and stays quiet if it can't load.
export function HomeFeatured() {
  const router = useRouter();
  const [data, setData] = useState<HomeFeaturedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getHomeContent();
        if (!cancelled) setData(res);
      } catch {
        // Home works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;
  const { announcements, offers, turfs, tournaments } = data;
  if (!announcements.length && !offers.length && !turfs.length && !tournaments.length) return null;

  return (
    <View className="mt-6" testID="home-featured">
      {announcements.map((a) => (
        <Pressable
          key={a.item_id}
          disabled={!a.link_url}
          onPress={() => a.link_url && Linking.openURL(a.link_url)}
          className="mb-3 rounded-lg bg-ink-black px-4 py-3"
          testID={`featured-announcement-${a.item_id}`}
        >
          <Text className="font-ui font-bold text-body text-white">{a.title}</Text>
          {a.body ? <Text className="mt-1 font-ui text-body text-white/80">{a.body}</Text> : null}
        </Pressable>
      ))}

      {offers.length > 0 && (
        <Section title="Offers for you">
          {offers.map((o) => (
            <Card key={o.item_id} testID={`featured-offer-${o.item_id}`}>
              <Text className="font-display text-[22px] text-brand-red">{o.code}</Text>
              <Text className="mt-1 font-ui text-body text-text-primary" numberOfLines={2}>
                {o.title || o.label}
              </Text>
              {o.min_booking_amount > 0 && (
                <Text className="mt-1 font-ui text-micro text-text-tertiary">
                  On bookings of ₹{o.min_booking_amount} or more
                </Text>
              )}
            </Card>
          ))}
        </Section>
      )}

      {turfs.length > 0 && (
        <Section title="Featured turfs">
          {turfs.map((t) => (
            <Card
              key={t.item_id}
              testID={`featured-turf-${t.item_id}`}
              onPress={() => router.push(`/(tabs)/discover/turf/${t.turf_id}`)}
            >
              <Text className="font-ui font-bold text-card-title text-ink-black" numberOfLines={1}>
                {t.title || t.turf_name}
              </Text>
              <Text className="mt-1 font-ui text-body text-text-tertiary">
                {t.city}
                {t.average_rating ? ` · ★ ${t.average_rating}` : ''}
              </Text>
            </Card>
          ))}
        </Section>
      )}

      {tournaments.length > 0 && (
        <Section title="Tournaments">
          {tournaments.map((t) => (
            <Card
              key={t.item_id}
              testID={`featured-tournament-${t.item_id}`}
              onPress={() => router.push(`/tournament/${t.tournament_id}`)}
            >
              <Text className="font-ui font-bold text-card-title text-ink-black" numberOfLines={2}>
                {t.title || t.name}
              </Text>
              <Text className="mt-1 font-ui text-body text-text-tertiary">
                {t.entry_fee > 0 ? `Entry ₹${t.entry_fee}` : 'Free entry'}
              </Text>
            </Card>
          ))}
        </Section>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="mb-2 font-ui font-bold text-card-title text-ink-black">{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

function Card({
  children,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      className="mr-3 rounded-lg border border-border-subtle bg-surface p-4"
      style={{ width: 220 }}
    >
      {children}
    </Pressable>
  );
}
