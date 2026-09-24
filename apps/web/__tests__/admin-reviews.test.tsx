import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getAllReviewsAdmin: jest.fn(),
    deleteReviewAdmin: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminReviewsPage from '../src/app/admin/reviews/page';

const mockGetAllReviewsAdmin = apiClient.getAllReviewsAdmin as jest.Mock;
const mockDeleteReviewAdmin = apiClient.deleteReviewAdmin as jest.Mock;

const REVIEW = {
  review_id: 'r1',
  match_id: 'm1',
  turf_id: 't1',
  turf_name: 'Green Park Box Cricket',
  player_id: 'p1',
  player_name: 'Asha Patel',
  rating: 5,
  review_text: 'Great turf!',
  created_at: '2026-01-01T00:00:00.000Z',
};

// Backlog E-5: Reviews Management in Admin Web.
describe('Admin Reviews page (backlog E-5)', () => {
  beforeEach(() => {
    mockGetAllReviewsAdmin.mockReset();
    mockDeleteReviewAdmin.mockReset();
    window.confirm = jest.fn().mockReturnValue(true);
  });

  it('shows every review with its turf, player, and rating', async () => {
    mockGetAllReviewsAdmin.mockResolvedValueOnce({ results: [REVIEW] });

    render(<AdminReviewsPage />);

    expect(await screen.findByText('Green Park Box Cricket')).toBeInTheDocument();
    expect(screen.getByText('Asha Patel')).toBeInTheDocument();
    expect(screen.getByText('5 ★')).toBeInTheDocument();
    expect(screen.getByText('Great turf!')).toBeInTheDocument();
  });

  it('falls back to an em dash for an anonymized/deleted player name', async () => {
    mockGetAllReviewsAdmin.mockResolvedValueOnce({
      results: [{ ...REVIEW, player_name: null }],
    });

    render(<AdminReviewsPage />);

    await screen.findByText('Green Park Box Cricket');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('can search by turf, player, or review text', async () => {
    mockGetAllReviewsAdmin.mockResolvedValueOnce({
      results: [
        REVIEW,
        {
          ...REVIEW,
          review_id: 'r2',
          turf_name: 'Riverside Turf',
          player_name: 'Rohan Mehta',
          review_text: 'Terrible experience',
        },
      ],
    });

    render(<AdminReviewsPage />);
    await screen.findByText('Green Park Box Cricket');

    fireEvent.change(screen.getByPlaceholderText(/turf, player, or review text/i), {
      target: { value: 'terrible' },
    });

    await waitFor(() =>
      expect(screen.queryByText('Green Park Box Cricket')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Riverside Turf')).toBeInTheDocument();
  });

  it('confirms, then deletes a review and reloads the list', async () => {
    mockGetAllReviewsAdmin
      .mockResolvedValueOnce({ results: [REVIEW] })
      .mockResolvedValueOnce({ results: [] });
    mockDeleteReviewAdmin.mockResolvedValueOnce(undefined);

    render(<AdminReviewsPage />);
    await screen.findByText('Green Park Box Cricket');

    fireEvent.click(screen.getByText('Delete'));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(mockDeleteReviewAdmin).toHaveBeenCalledWith('r1'));
    await waitFor(() =>
      expect(screen.queryByText('Green Park Box Cricket')).not.toBeInTheDocument(),
    );
  });

  it('does not delete when the confirmation is declined', async () => {
    window.confirm = jest.fn().mockReturnValue(false);
    mockGetAllReviewsAdmin.mockResolvedValueOnce({ results: [REVIEW] });

    render(<AdminReviewsPage />);
    await screen.findByText('Green Park Box Cricket');

    fireEvent.click(screen.getByText('Delete'));

    expect(mockDeleteReviewAdmin).not.toHaveBeenCalled();
  });
});
