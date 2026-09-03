import React, { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';

// In-app dispute flow for scoring/result disagreements (module 2.13, PRD
// §32.2) — linked from the Match Result/Scorecard screens (module 2.8).
export default function MatchDisputeScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (description.trim().length < 5) {
      setError('Describe the disagreement in a bit more detail.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.createMatchDispute(matchId, description.trim());
      router.replace('/complaint-status');
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not submit your dispute.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title="Dispute Result" />
      <Text className="font-ui text-body text-text-secondary mb-4">
        Tell us what&apos;s wrong with this match&apos;s score or result — a support agent will
        review it.
      </Text>
      <TextField
        label="What happened?"
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. The final score doesn't match what was scored…"
        multiline
        numberOfLines={5}
        style={{ height: 120, textAlignVertical: 'top' }}
        testID="dispute-description"
      />
      {error && (
        <Text className="text-brand-red text-body mb-4" testID="dispute-error">
          {error}
        </Text>
      )}
      <Button
        label="Submit Dispute"
        onPress={submit}
        loading={submitting}
        testID="submit-dispute"
      />
    </ScreenContainer>
  );
}
