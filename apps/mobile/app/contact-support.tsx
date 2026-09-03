import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { SupportCategory } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { ChipSelect } from '../src/components/ChipSelect';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';

const CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: 'PAYMENT_ISSUE', label: 'Payment' },
  { value: 'BOOKING_ISSUE', label: 'Booking' },
  { value: 'MATCH_ISSUE', label: 'Match' },
  { value: 'ACCOUNT_ISSUE', label: 'Account' },
  { value: 'OTHER', label: 'Other' },
];

// Submit Complaint (module 2.13, PRD §12.57) — the general Contact Support
// form; every category funnels into the same support_tickets ticket the
// Complaint Status screen tracks.
export default function ContactSupportScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<SupportCategory>('OTHER');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (description.trim().length < 5) {
      setError('Describe the issue in a bit more detail.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.createComplaint({ category, description: description.trim() });
      router.replace('/complaint-status');
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not submit your complaint.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title="Contact Support" />
      <ChipSelect
        label="Category"
        options={CATEGORIES}
        value={category}
        onChange={(v) => setCategory(v as SupportCategory)}
        testID="complaint-category"
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Tell us what happened…"
        multiline
        numberOfLines={5}
        style={{ height: 120, textAlignVertical: 'top' }}
        testID="complaint-description"
      />
      {error && (
        <Text className="text-brand-red text-body mb-4" testID="complaint-error">
          {error}
        </Text>
      )}
      <Button
        label="Submit Complaint"
        onPress={submit}
        loading={submitting}
        testID="submit-complaint"
      />
    </ScreenContainer>
  );
}
