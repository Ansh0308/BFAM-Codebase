import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';
import { BFAMApiError } from '@bfam/api-client';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { createComplaint: jest.fn() },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockCreateComplaint = apiClient.createComplaint as jest.Mock;

import ContactSupportScreen from '../app/contact-support';

describe('Contact Support / Submit Complaint form (module 2.13, PRD §12.57)', () => {
  beforeEach(() => {
    mockCreateComplaint.mockReset();
    mockReplace.mockReset();
  });

  it('defaults to the OTHER category and submits the typed description', async () => {
    mockCreateComplaint.mockResolvedValueOnce({ ticket_id: 't1' });
    const { getByTestId } = render(<ContactSupportScreen />);

    fireEvent.changeText(getByTestId('complaint-description'), 'My payment was charged twice.');
    fireEvent.press(getByTestId('submit-complaint'));

    await waitFor(() =>
      expect(mockCreateComplaint).toHaveBeenCalledWith({
        category: 'OTHER',
        description: 'My payment was charged twice.',
      }),
    );
  });

  it('submits the selected category when a chip is chosen', async () => {
    mockCreateComplaint.mockResolvedValueOnce({ ticket_id: 't1' });
    const { getByTestId } = render(<ContactSupportScreen />);

    fireEvent.press(getByTestId('complaint-category-PAYMENT_ISSUE'));
    fireEvent.changeText(getByTestId('complaint-description'), 'My payment was charged twice.');
    fireEvent.press(getByTestId('submit-complaint'));

    await waitFor(() =>
      expect(mockCreateComplaint).toHaveBeenCalledWith({
        category: 'PAYMENT_ISSUE',
        description: 'My payment was charged twice.',
      }),
    );
  });

  it('rejects a too-short description without calling the API', () => {
    const { getByTestId, getByText } = render(<ContactSupportScreen />);

    fireEvent.changeText(getByTestId('complaint-description'), 'hi');
    fireEvent.press(getByTestId('submit-complaint'));

    expect(getByText(/more detail/i)).toBeTruthy();
    expect(mockCreateComplaint).not.toHaveBeenCalled();
  });

  it('navigates to Complaint Status on success', async () => {
    mockCreateComplaint.mockResolvedValueOnce({ ticket_id: 't1' });
    const { getByTestId } = render(<ContactSupportScreen />);

    fireEvent.changeText(getByTestId('complaint-description'), 'My payment was charged twice.');
    fireEvent.press(getByTestId('submit-complaint'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/complaint-status'));
  });

  it('surfaces a backend error instead of navigating away', async () => {
    mockCreateComplaint.mockRejectedValueOnce(new BFAMApiError('Invalid complaint payload', 400));
    const { getByTestId, findByTestId } = render(<ContactSupportScreen />);

    fireEvent.changeText(getByTestId('complaint-description'), 'My payment was charged twice.');
    fireEvent.press(getByTestId('submit-complaint'));

    expect(await findByTestId('complaint-error')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
