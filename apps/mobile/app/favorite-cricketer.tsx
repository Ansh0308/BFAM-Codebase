import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Cricketer } from '@bfam/shared-types';
import { AuthScreenBackground } from '../src/components/AuthScreenBackground';
import { TextField } from '../src/components/TextField';
import { CricketerSearchResultItem } from '../src/components/CricketerSearchResultItem';
import { apiClient } from '../src/lib/apiClient';
import { useSignupStore } from '../src/store/signupStore';
import { useAuthStore } from '../src/store/authStore';
import { completeAccountCreation } from '../src/services/completeAccountCreation';

const DEBOUNCE_MS = 350;

// Mandatory step for the PLAYER signup branch — a player must pick a
// favorite cricketer to continue (product decision overriding PRD §12.60's
// "optional and skippable", confirmed with the product owner; see the
// updated §12.60 note in BFAM_PRD_v2.2.md). Only the selected
// name/external_id are persisted (via the final account-creation call) —
// never a local cricketer table.
export default function FavoriteCricketer() {
  const router = useRouter();
  const identifier = useSignupStore((s) => s.identifier);
  const password = useSignupStore((s) => s.password);
  const signupToken = useSignupStore((s) => s.signupToken);
  const socialTicket = useSignupStore((s) => s.socialTicket);
  const role = useSignupStore((s) => s.role);
  const setFavoriteCricketer = useSignupStore((s) => s.setFavoriteCricketer);
  const setSession = useAuthStore((s) => s.setSession);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Cricketer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await apiClient.searchCricketers(query.trim());
        setResults(data);
      } catch {
        setResults([]);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  async function finishSignup(name: string, externalId: string) {
    if (!role) {
      setError('Something went wrong — please restart signup.');
      return;
    }
    setFavoriteCricketer(name, externalId);
    setError(null);
    setLoading(true);
    try {
      const result = await completeAccountCreation({
        role,
        identifier: identifier ?? '',
        password: password ?? '',
        signupToken,
        socialTicket,
        favoriteCricketerName: name,
        favoriteCricketerExternalId: externalId,
      });
      await setSession(result.token, { user_id: result.user_id, bfam_id: result.bfam_id, role });
      router.push({ pathname: '/bfam-id-confirmation', params: { bfam_id: result.bfam_id } });
    } catch {
      setError('Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenBackground>
      <View className="mt-10 mb-2">
        <Text className="font-display text-hero text-brand-red">BFAM</Text>
      </View>

      <View className="mb-2">
        <Text className="font-ui font-bold text-title-xl text-ink-black leading-tight">
          Favorite
        </Text>
        <Text className="font-ui font-bold text-title-xl text-brand-red leading-tight">
          Cricketer
        </Text>
      </View>
      <View className="flex-row items-center mb-6">
        <Text className="font-ui text-body text-text-secondary">
          Search for your favorite cricketer to continue.
        </Text>
      </View>

      <TextField
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. Virat Kohli"
        testID="cricketer-search-input"
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

      {error ? <Text className="font-ui text-body text-brand-red-dark mb-4">{error}</Text> : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.external_id}
        renderItem={({ item }) => (
          <CricketerSearchResultItem
            cricketer={item}
            onPress={() => finishSignup(item.name, item.external_id)}
            testID={`cricketer-result-${item.external_id}`}
          />
        )}
      />

      {loading ? (
        <Text className="font-ui text-body text-text-tertiary text-center mt-4">
          Creating your account…
        </Text>
      ) : null}
    </AuthScreenBackground>
  );
}
