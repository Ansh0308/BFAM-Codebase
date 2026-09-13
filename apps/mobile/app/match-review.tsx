import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';

const STAR_RATINGS = [1, 2, 3, 4, 5];

// Post-Match Review (backlog B-4): rate 1-5 stars, optional text, rewarded
// with a flat BFAM Coins amount (see COIN_REWARD_PER_REVIEW server-side) —
// linked from the Match Result screen once a match is finalized.
export default function MatchReviewScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coinsAwarded, setCoinsAwarded] = useState<number | null>(null);

  async function submit() {
    if (!rating) {
      setError('Pick a star rating to continue.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.submitReview(matchId, {
        rating,
        review_text: reviewText.trim() || null,
      });
      setCoinsAwarded(result.coins_awarded);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not submit your review.');
    } finally {
      setSubmitting(false);
    }
  }

  if (coinsAwarded != null) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-6" testID="review-submitted">
          <Feather name="award" size={56} color="#D80000" />
          <Text className="font-ui font-bold text-title-xl text-ink-black text-center mt-4">
            Thanks for the feedback!
          </Text>
          <Text className="font-ui text-body text-text-secondary text-center mt-2">
            You earned {coinsAwarded} BFAM Coins.
          </Text>
          <View className="mt-8 w-full">
            <Button label="Done" onPress={() => router.back()} testID="review-done" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title="Rate This Match" />
      <Text className="font-ui text-body text-text-secondary mb-4">
        How was your experience? Leaving a review earns you BFAM Coins.
      </Text>

      <View className="flex-row justify-center mb-6" testID="star-rating">
        {STAR_RATINGS.map((value) => (
          <Pressable
            key={value}
            onPress={() => setRating(value)}
            hitSlop={8}
            className="mx-1"
            testID={`star-${value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: rating != null && value <= rating }}
          >
            <Feather
              name="star"
              size={36}
              color={rating != null && value <= rating ? '#D80000' : '#D9D9D9'}
            />
          </Pressable>
        ))}
      </View>

      <TextField
        label="Comments (optional)"
        value={reviewText}
        onChangeText={setReviewText}
        placeholder="Tell us more about the turf, the match, anything…"
        multiline
        numberOfLines={5}
        style={{ height: 120, textAlignVertical: 'top' }}
        testID="review-text-input"
      />

      {error && (
        <Text className="text-brand-red text-body mb-4" testID="review-error">
          {error}
        </Text>
      )}

      <Button label="Submit Review" onPress={submit} loading={submitting} testID="submit-review" />
    </ScreenContainer>
  );
}
