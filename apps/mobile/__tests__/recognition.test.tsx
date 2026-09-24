import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getMonthlyRecognition: jest.fn() },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

const mockGet = apiClient.getMonthlyRecognition as jest.Mock;

import RecognitionScreen, { shiftMonth } from '../app/recognition';

// Long tail — Special Recognition (PRD §12.39).
describe('shiftMonth', () => {
  it('rolls across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('RecognitionScreen', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({
      month: '2026-09',
      awards: [
        {
          award: 'BATTING_STAR',
          player_id: 'a',
          bfam_id: 'BF1',
          full_name: 'Asha Rao',
          value: 120,
        },
      ],
    });
  });

  it('shows awards for the current month', async () => {
    const { findByText, findByTestId } = await render(<RecognitionScreen />);
    expect(await findByText('Asha Rao')).toBeTruthy();
    expect(await findByTestId('award-BATTING_STAR')).toBeTruthy();
  });

  it('reloads for the previous month', async () => {
    const { findByTestId } = await render(<RecognitionScreen />);
    await findByTestId('award-BATTING_STAR');
    await fireEvent.press(await findByTestId('recognition-prev'));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(mockGet.mock.calls[1][0]).toBe(shiftMonth(mockGet.mock.calls[0][0], -1));
  });

  it('shows an empty state', async () => {
    mockGet.mockResolvedValue({ month: '2026-09', awards: [] });
    const { findByText } = await render(<RecognitionScreen />);
    expect(await findByText(/No awards for this month/)).toBeTruthy();
  });

  it('shows an error when loading fails', async () => {
    mockGet.mockRejectedValue(new Error('x'));
    const { findByText } = await render(<RecognitionScreen />);
    expect(await findByText(/could not load recognition/i)).toBeTruthy();
  });
});
