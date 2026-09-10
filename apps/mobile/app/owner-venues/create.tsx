import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { apiClient } from '../../src/lib/apiClient';

const MIN_PITCHES = 1;
const MAX_PITCHES = 20;

// Add Venue (feedback backlog A-2, simplified per follow-up feedback): one
// screen for an owner's turf/venue details plus how many pitches they have
// there — venue and every pitch under it are created together in a single
// step, instead of creating the venue and then each pitch separately. Each
// pitch is still its own fully independent, bookable turf (auto-named
// "Pitch 1"/"Pitch 2"/... — rename any of them from its own management
// screen after creation).
export default function CreateVenueScreen() {
  const router = useRouter();
  const [venueName, setVenueName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [pitchCount, setPitchCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
      !venueName.trim() ||
      !addressLine.trim() ||
      !city.trim() ||
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {
      setError('Fill in every field with a valid latitude/longitude.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const venue = await apiClient.createVenue({
        venue_name: venueName.trim(),
        address_line: addressLine.trim(),
        city: city.trim(),
        latitude: lat,
        longitude: lng,
        pitch_count: pitchCount,
      });
      router.replace(`/owner-venues/${venue.venue_id}`);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the venue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title="Add Turf" />
      <Text className="font-ui text-body text-text-tertiary mb-4" style={{ marginTop: -8 }}>
        Enter your turf&apos;s details, then tell us how many pitches you have there — we&apos;ll
        set them all up at once.
      </Text>
      <TextField
        label="Turf / Venue Name"
        value={venueName}
        onChangeText={setVenueName}
        testID="venue-name-input"
      />
      <TextField
        label="Address"
        value={addressLine}
        onChangeText={setAddressLine}
        testID="venue-address-input"
      />
      <TextField label="City" value={city} onChangeText={setCity} testID="venue-city-input" />
      <TextField
        label="Latitude"
        value={latitude}
        onChangeText={setLatitude}
        keyboardType="numeric"
        testID="venue-latitude-input"
      />
      <TextField
        label="Longitude"
        value={longitude}
        onChangeText={setLongitude}
        keyboardType="numeric"
        testID="venue-longitude-input"
      />

      <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
        How Many Pitches / Turfs?
      </Text>
      <View className="flex-row items-center mb-4">
        <Pressable
          onPress={() => setPitchCount((n) => Math.max(MIN_PITCHES, n - 1))}
          className="bg-surface-alt rounded-md items-center justify-center"
          style={{ width: 44, height: 44 }}
          testID="pitch-count-decrease"
        >
          <Text className="font-ui text-title-md text-text-primary">−</Text>
        </Pressable>
        <Text
          className="font-ui font-bold text-title-md text-text-primary mx-4"
          testID="pitch-count-value"
        >
          {pitchCount}
        </Text>
        <Pressable
          onPress={() => setPitchCount((n) => Math.min(MAX_PITCHES, n + 1))}
          className="bg-surface-alt rounded-md items-center justify-center"
          style={{ width: 44, height: 44 }}
          testID="pitch-count-increase"
        >
          <Text className="font-ui text-title-md text-text-primary">+</Text>
        </Pressable>
      </View>
      <Text className="font-ui text-micro text-text-tertiary mb-4" style={{ marginTop: -8 }}>
        {pitchCount === 1
          ? 'We’ll create 1 pitch for you to set up.'
          : `We’ll create ${pitchCount} pitches ("Pitch 1"–"Pitch ${pitchCount}") for you to set up — each is booked separately.`}
      </Text>

      {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}
      <Button
        label="Create Turf"
        onPress={submit}
        loading={submitting}
        testID="submit-create-venue"
      />
    </ScreenContainer>
  );
}
