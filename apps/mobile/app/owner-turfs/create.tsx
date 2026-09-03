import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { apiClient } from '../../src/lib/apiClient';

// Turf Management (module 2.12, PRD §8.3/§9.2) — add a turf.
export default function CreateTurfScreen() {
  const router = useRouter();
  const [turfName, setTurfName] = useState('');
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
      !turfName.trim() ||
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
      const turf = await apiClient.createTurf({
        turf_name: turfName.trim(),
        address_line: addressLine.trim(),
        city: city.trim(),
        latitude: lat,
        longitude: lng,
      });
      router.replace(`/owner-turfs/${turf.turf_id}`);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the turf.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title="Add Turf" />
      <TextField
        label="Turf Name"
        value={turfName}
        onChangeText={setTurfName}
        testID="turf-name-input"
      />
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
