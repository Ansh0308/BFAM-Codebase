import React, { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';

// Injury report flow (module 2.13, PRD §32.9) — tied server-side to the
// liability waiver captured at account creation (see
// services/supportService.ts and accountService.ts on the backend for
// what that gate actually checks); `matchId` is optional since this
// screen is reachable both from a match context and standalone from Help
// Center.
export default function InjuryReportScreen() {
  const { matchId } = useLocalSearchParams<{ matchId?: string }>();
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (description.trim().length < 5) {
      setError('Describe the injury in a bit more detail.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.createInjuryReport(description.trim(), matchId ?? null);
      router.replace('/complaint-status');
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not submit your injury report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title="Report an Injury" />
      <TextField
        label="What happened?"
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the injury and how it happened…"
        multiline
        numberOfLines={5}
        style={{ height: 120, textAlignVertical: 'top' }}
        testID="injury-description"
      />
      {error && (
        <Text className="text-brand-red text-body mb-4" testID="injury-error">
          {error}
        </Text>
      )}
      <Button
        label="Submit Report"
        onPress={submit}
        loading={submitting}
        testID="submit-injury-report"
      />
    </ScreenContainer>
  );
}
