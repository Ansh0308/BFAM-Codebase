import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';
import { BFAMApiError } from '@bfam/api-client';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { submitReview: jest.fn() },
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'm1' }),
  useRouter: () => ({ back: mockBack }),
}));

const mockSubmitReview = apiClient.submitReview as jest.Mock;

import MatchReviewScreen from '../app/match-review';

// Backlog B-4: post-match review, rewarded with BFAM Coins.
describe('Match Review screen (backlog B-4)', () => {
  beforeEach(() => {
    mockSubmitReview.mockReset();
    mockBack.mockReset();
  });

  it('submits the picked star rating and optional comments for the match in the route params', async () => {
    mockSubmitReview.mockResolvedValueOnce({
      review_id: 'r1',
      coins_awarded: 20,
      coin_balance: 20,
    });
    const { getByTestId } = await render(<MatchReviewScreen />);

    await fireEvent.press(getByTestId('star-4'));
    await fireEvent.changeText(getByTestId('review-text-input'), 'Great turf, well organized.');
    await fireEvent.press(getByTestId('submit-review'));

    await waitFor(() =>
      expect(mockSubmitReview).toHaveBeenCalledWith('m1', {
        rating: 4,
        review_text: 'Great turf, well organized.',
      }),
    );
  });

  it('shows the coins awarded once the review is submitted', async () => {
    mockSubmitReview.mockResolvedValueOnce({
      review_id: 'r1',
      coins_awarded: 20,
      coin_balance: 20,
    });
    const { getByTestId, findByTestId, findByText } = await render(<MatchReviewScreen />);

    await fireEvent.press(getByTestId('star-5'));
    await fireEvent.press(getByTestId('submit-review'));

    await findByTestId('review-submitted');
    await findByText(/earned 20 bfam coins/i);
  });

  it('requires a star rating before submitting', async () => {
    const { getByTestId, getByText } = await render(<MatchReviewScreen />);

    await fireEvent.press(getByTestId('submit-review'));

    expect(getByText(/pick a star rating/i)).toBeTruthy();
    expect(mockSubmitReview).not.toHaveBeenCalled();
  });

  it('surfaces a rejected review (e.g. already reviewed) instead of showing the coins screen', async () => {
    mockSubmitReview.mockRejectedValueOnce(
      new BFAMApiError('You have already reviewed this match.', 409),
    );
    const { getByTestId, findByTestId, queryByTestId } = await render(<MatchReviewScreen />);

    await fireEvent.press(getByTestId('star-3'));
    await fireEvent.press(getByTestId('submit-review'));

    expect(await findByTestId('review-error')).toBeTruthy();
    expect(queryByTestId('review-submitted')).toBeNull();
  });
});
