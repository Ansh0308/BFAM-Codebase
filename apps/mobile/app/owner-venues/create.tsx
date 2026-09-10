import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { apiClient } from '../../src/lib/apiClient';

// Venues (feedback backlog A-2) — an owner with more than one pitch at the
// same physical location (e.g. "Redline Sports Complex" with Pitch 1/Pitch
// 2) creates one venue here, then adds each pitch under it from Add Turf.
// Each pitch stays its own independently bookable turf; the venue is only
// a shared address/display grouping.
export default function CreateVenueScreen() {
  const router = useRouter();
  const [venueName, setVenueName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
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
      <ScreenHeader title="Add Venue" />
      <TextField
        label="Venue Name"
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
      {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}
      <Button
        label="Create Venue"
        onPress={submit}
        loading={submitting}
        testID="submit-create-venue"
      />
    </ScreenContainer>
  );
}
