import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { VenueListItem } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { ChipSelect } from '../../src/components/ChipSelect';
import { Button } from '../../src/components/Button';
import { apiClient } from '../../src/lib/apiClient';

const STANDALONE = 'STANDALONE';

// Turf Management (module 2.12, PRD §8.3/§9.2) — add a turf. Backlog A-2:
// an owner with more than one pitch at the same physical location can add
// this pitch under an existing venue instead of giving it its own address —
// the venue's address is then auto-filled and stays locked to it.
export default function CreateTurfScreen() {
  const router = useRouter();
  const { venueId: presetVenueId } = useLocalSearchParams<{ venueId?: string }>();

  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [venueChoice, setVenueChoice] = useState<string>(presetVenueId || STANDALONE);

  const [turfName, setTurfName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getMyVenues()
      .then((res) => setVenues(res.results))
      .catch(() => setVenues([]));
  }, []);

  async function submit() {
    if (!turfName.trim()) {
      setError('Enter a turf name.');
      return;
    }

    const usingVenue = venueChoice !== STANDALONE;
    let lat = 0;
    let lng = 0;
    if (!usingVenue) {
      lat = Number(latitude);
      lng = Number(longitude);
      if (!addressLine.trim() || !city.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
        setError('Fill in every field with a valid latitude/longitude.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const turf = await apiClient.createTurf(
        usingVenue
          ? { turf_name: turfName.trim(), venue_id: venueChoice }
          : {
              turf_name: turfName.trim(),
              address_line: addressLine.trim(),
              city: city.trim(),
              latitude: lat,
              longitude: lng,
            },
      );
      router.replace(`/owner-turfs/${turf.turf_id}`);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the turf.');
    } finally {
      setSubmitting(false);
    }
  }

  const venueOptions = [
    { value: STANDALONE, label: 'Standalone' },
    ...venues.map((v) => ({ value: v.venue_id, label: v.venue_name })),
  ];

  return (
    <ScreenContainer scroll>
      <ScreenHeader title="Add Turf" />
      <TextField
        label="Turf Name"
        value={turfName}
        onChangeText={setTurfName}
        testID="turf-name-input"
      />

      <ChipSelect
        label="Venue"
        options={venueOptions}
        value={venueChoice}
        onChange={setVenueChoice}
        testID="turf-venue-select"
      />
      <Pressable
        onPress={() => router.push('/owner-venues/create')}
        testID="new-venue-link"
        style={{ marginTop: -12 }}
        className="mb-4"
      >
        <Text className="font-ui text-micro text-brand-red">
          Don&apos;t see the venue you want? + Create a new venue
        </Text>
      </Pressable>

      {venueChoice === STANDALONE ? (
        <>
          <TextField
            label="Address"
            value={addressLine}
            onChangeText={setAddressLine}
            testID="turf-address-input"
          />
          <TextField label="City" value={city} onChangeText={setCity} testID="turf-city-input" />
          <TextField
            label="Latitude"
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="numeric"
            testID="turf-latitude-input"
          />
          <TextField
            label="Longitude"
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="numeric"
            testID="turf-longitude-input"
          />
        </>
      ) : (
        <Text
          className="font-ui text-body text-text-tertiary mb-4"
          testID="turf-venue-address-note"
        >
          This pitch will use the venue&apos;s address.
        </Text>
      )}

      {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}
      <Button
        label="Create Turf"
        onPress={submit}
        loading={submitting}
        testID="submit-create-turf"
      />
    </ScreenContainer>
  );
}
