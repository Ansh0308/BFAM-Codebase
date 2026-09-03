import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import type { TurfListItem } from '@bfam/shared-types';
import { apiClient } from '../../../src/lib/apiClient';
import { colors } from '../../../src/theme/tokens';
import { TurfCard } from '../../../src/components/TurfCard';
import { ScreenContainer } from '../../../src/components/ScreenContainer';

interface Coords {
  lat: number;
  lng: number;
}

// Turf Listing: search/filter only (PRD §12.7). Map view is explicitly
// deferred for this module. "Near You" (Design §3.3) is sorted by real
// distance when location is available — the backend already supports
// lat/lng (turfService.listTurfs' distance_km sort), this screen just
// never asked for it.
export default function TurfListing() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TurfListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const coordsRef = useRef<Coords | null>(null);

  const fetchTurfs = useCallback(async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const here = coordsRef.current;
      const response = await apiClient.getTurfs({
        ...(searchTerm ? { q: searchTerm } : {}),
        ...(here ? { lat: here.lat, lng: here.lng } : {}),
      });
      setResults(response.results);
    } catch {
      setError('Could not load turfs. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Best-effort: ask for location once on mount so "Near You" can sort by
  // real distance. A denied/unavailable permission just falls back to the
  // existing unsorted listing — this is a nice-to-have, never blocking.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const here = { lat: position.coords.latitude, lng: position.coords.longitude };
        coordsRef.current = here;
        setCoords(here);
      } catch {
        // No location permission/services — silently fall back.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch every time this tab gains focus (not just on first mount) — a
  // turf created/updated in the Owner portal while this tab was already
  // mounted would otherwise never show up here, same as the sibling
  // Matches/Teams tabs. Also refetches once location resolves, so "Near
  // You" picks up real distance sorting without waiting for a manual
  // search or re-focus.
  useFocusEffect(
    useCallback(() => {
      fetchTurfs(query);
    }, [fetchTurfs, query, coords]),
  );

  const openDetails = (turfId: string) => router.push(`/(tabs)/discover/turf/${turfId}`);

  return (
    <ScreenContainer>
      <Text className="font-ui font-bold text-title-xl text-ink-black mt-6 mb-4">Discover</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => fetchTurfs(query)}
        placeholder="Search turfs, players..."
        placeholderTextColor={colors.textTertiary}
        className="bg-surface border border-border-strong rounded-md px-4 py-3 mb-5 font-ui text-body text-text-primary"
        testID="turf-search-input"
        returnKeyType="search"
      />

      {loading && (
        <View className="py-10 items-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="turf-listing-loading" />
        </View>
      )}

      {!loading && error && (
        <Text className="text-text-secondary text-body text-center mt-6">{error}</Text>
      )}

      {!loading && !error && results.length === 0 && (
        <Text className="text-text-secondary text-body text-center mt-6">
          No turfs match your search.
        </Text>
      )}

      {!loading && !error && results.length > 0 && (
        <>
          <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-3">
            Near You
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            {results.slice(0, 6).map((turf) => (
              <TurfCard
                key={turf.turf_id}
                turf={turf}
                variant="horizontal"
                onPress={() => openDetails(turf.turf_id)}
              />
            ))}
          </ScrollView>

          <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-3">
            All Turfs
          </Text>
          <FlatList
            data={results}
            keyExtractor={(item) => item.turf_id}
            renderItem={({ item }) => (
              <TurfCard turf={item} onPress={() => openDetails(item.turf_id)} />
            )}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </ScreenContainer>
  );
}
