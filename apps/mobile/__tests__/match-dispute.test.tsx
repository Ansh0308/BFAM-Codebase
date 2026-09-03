import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';
import { BFAMApiError } from '@bfam/api-client';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { createMatchDispute: jest.fn() },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'm1' }),
  useRouter: () => ({ replace: mockReplace }),
}));

const mockCreateMatchDispute = apiClient.createMatchDispute as jest.Mock;

import MatchDisputeScreen from '../app/match-dispute';

// Covers module 2.13 requirement 4's "dispute flow" from the client side —
// the server-side state-machine transitions themselves are unit-tested in
// apps/backend/src/__tests__/supportTicketStateMachine.test.ts.
describe('Dispute Result flow (module 2.13, PRD §32.2)', () => {
  beforeEach(() => {
    mockCreateMatchDispute.mockReset();
    mockReplace.mockReset();
  });

  it('submits the dispute for the match in the route params', async () => {
    mockCreateMatchDispute.mockResolvedValueOnce({ ticket_id: 't1', status: 'OPEN' });
    const { getByTestId } = render(<MatchDisputeScreen />);

    fireEvent.changeText(getByTestId('dispute-description'), "The final score doesn't match.");
    fireEvent.press(getByTestId('submit-dispute'));

    await waitFor(() =>
      expect(mockCreateMatchDispute).toHaveBeenCalledWith('m1', "The final score doesn't match."),
    );
  });

  it('a freshly submitted dispute lands in the OPEN state and routes to Complaint Status', async () => {
    mockCreateMatchDispute.mockResolvedValueOnce({ ticket_id: 't1', status: 'OPEN' });
    const { getByTestId } = render(<MatchDisputeScreen />);

    fireEvent.changeText(getByTestId('dispute-description'), "The final score doesn't match.");
    fireEvent.press(getByTestId('submit-dispute'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/complaint-status'));
  });

  it('rejects a too-short description without calling the API', () => {
    const { getByTestId, getByText } = render(<MatchDisputeScreen />);

    fireEvent.changeText(getByTestId('dispute-description'), 'no');
    fireEvent.press(getByTestId('submit-dispute'));

    expect(getByText(/more detail/i)).toBeTruthy();
    expect(mockCreateMatchDispute).not.toHaveBeenCalled();
  });

  it('surfaces a rejected dispute (e.g. not a roster participant) instead of navigating away', async () => {
    mockCreateMatchDispute.mockRejectedValueOnce(
      new BFAMApiError('Only someone who played in this match can dispute its result.', 403),
    );
    const { getByTestId, findByTestId } = render(<MatchDisputeScreen />);

    fireEvent.changeText(getByTestId('dispute-description'), "The final score doesn't match.");
    fireEvent.press(getByTestId('submit-dispute'));

    expect(await findByTestId('dispute-error')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
