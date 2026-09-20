import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { PlayerSearchResult } from '@bfam/shared-types';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { TextField } from '../src/components/TextField';
import { PlayerSearchResultItem } from '../src/components/PlayerSearchResultItem';
import { apiClient } from '../src/lib/apiClient';

const DEBOUNCE_MS = 350;

// Backlog B-12 (feedback: "add a player search option in the top
// navigation bar... search for a player and view their profile"). Reached
// via the search icon in the Home tab's top nav; lands on the existing
// public profile screen (backlog B-10) — nothing here duplicates what that
// screen already shows.
export default function PlayerSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { results: found } = await apiClient.searchPlayers(query.trim());
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setSearched(true);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <ScreenContainer>
      <ScreenHeader title="Find a Player" />
      <TextField
        label=""
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or BFAM ID"
        autoCapitalize="none"
        testID="player-search-input"
        iconLeft={<Feather name="search" size={18} color="#D80000" />}
        rightAction={
          query ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Feather name="x-circle" size={18} color="#D80000" />
            </Pressable>
          ) : undefined
        }
      />

      {searched && results.length === 0 ? (
        <Text
          className="font-ui text-body text-text-secondary text-center mt-8"
          testID="player-search-empty"
        >
          No players match &quot;{query}&quot;.
        </Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.player_id}
          renderItem={({ item }) => (
            <PlayerSearchResultItem
              player={item}
              onPress={() => router.push(`/player-profile?playerId=${item.player_id}`)}
              testID={`player-search-result-${item.player_id}`}
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}
