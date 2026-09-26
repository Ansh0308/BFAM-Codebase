import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BallLoader } from '../../src/components/BallLoader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { VenueDetails } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { apiClient } from '../../src/lib/apiClient';

// Venue detail (feedback backlog A-2) — lists every pitch grouped under
// this venue ("Redline Sports Complex — Pitch 1 / Pitch 2") and lets the
// owner edit the shared venue address, which cascades to every pitch here.
export default function ManageVenueScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const router = useRouter();

  const [venue, setVenue] = useState<VenueDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [venueName, setVenueName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getVenue(venueId)
      .then((v) => {
        setVenue(v);
        setVenueName(v.venue_name);
        setAddressLine(v.address_line);
        setCity(v.city);
      })
      .catch(() => setError('Could not load this venue.'))
      .finally(() => setLoading(false));
  }, [venueId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateVenue(venueId, {
        venue_name: venueName,
        address_line: addressLine,
        city,
      });
      load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save venue details.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <BallLoader testID="manage-venue-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (!venue) {
    return (
      <ScreenContainer>
        <Text
          className="font-ui text-body text-text-secondary text-center mt-8"
          testID="manage-venue-error"
        >
          Could not load this venue.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title={venue.venue_name} />
      {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2 mt-2">
        Venue Details
      </Text>
      <Text className="font-ui text-micro text-text-tertiary mb-3">
        Editing the address here updates every pitch at this venue.
      </Text>
      <TextField
        label="Venue Name"
        value={venueName}
        onChangeText={setVenueName}
        testID="edit-venue-name"
      />
      <TextField
        label="Address"
        value={addressLine}
        onChangeText={setAddressLine}
        testID="edit-venue-address"
      />
      <TextField label="City" value={city} onChangeText={setCity} testID="edit-venue-city" />
      <Button label="Save Details" onPress={save} loading={saving} testID="save-venue-details" />

      <View className="flex-row items-center justify-between mb-2 mt-6">
        <Text className="font-ui font-bold text-text-secondary text-micro uppercase">
          Pitches ({venue.turfs.length})
        </Text>
        <Pressable
          onPress={() => router.push(`/owner-turfs/create?venueId=${venue.venue_id}`)}
          testID="add-pitch-button"
        >
          <Text className="font-ui font-bold text-body text-brand-red">+ Add Pitch</Text>
        </Pressable>
      </View>

      {venue.turfs.length === 0 ? (
        <Text className="font-ui text-body text-text-tertiary mt-4" testID="venue-pitches-empty">
          No pitches yet — add the first one at this venue.
        </Text>
      ) : (
        venue.turfs.map((t) => (
          <Pressable
            key={t.turf_id}
            onPress={() => router.push(`/owner-turfs/${t.turf_id}`)}
            className="bg-surface-alt rounded-lg p-4 mb-3"
            testID={`venue-pitch-card-${t.turf_id}`}
          >
            <Text className="font-ui font-bold text-body text-text-primary">{t.turf_name}</Text>
            <Text className="font-ui text-micro text-text-tertiary mt-1">{t.turf_status}</Text>
          </Pressable>
        ))
      )}

      <View className="mb-10" />
    </ScreenContainer>
  );
}
