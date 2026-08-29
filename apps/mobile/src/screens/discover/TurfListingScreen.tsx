import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, TextInput, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { TurfListItem } from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { colors } from '../../theme/tokens';
import { TurfCard } from '../../components/TurfCard';
import type { DiscoverStackParamList } from '../../navigation/types';

type Props = StackScreenProps<DiscoverStackParamList, 'TurfListing'>;

// Turf Listing: search/filter only (PRD §12.7). Map view is explicitly
// deferred for this module.
export function TurfListingScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TurfListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTurfs = useCallback(async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getTurfs(searchTerm ? { q: searchTerm } : {});
      setResults(response.results);
    } catch {
      setError('Could not load turfs. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTurfs('');
  }, [fetchTurfs]);

  const openDetails = (turfId: string) => navigation.navigate('TurfDetails', { turfId });

  return (
    <View className="flex-1 bg-surface-alt px-6 pt-6">
      <Text className="font-display text-title-xl text-ink-black uppercase mb-4">Discover</Text>

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
    </View>
  );
}
