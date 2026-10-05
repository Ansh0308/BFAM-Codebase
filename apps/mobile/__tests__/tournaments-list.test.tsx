import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({ apiClient: { getTournaments: jest.fn() } }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

import TournamentsScreen from '../app/tournaments';

const getTournaments = apiClient.getTournaments as jest.Mock;

const t = (id: string, over: Record<string, unknown> = {}) => ({
  tournament_id: id,
  name: `Cup ${id}`,
  description: null,
  format: 'LEAGUE_KNOCKOUT',
  turf_id: 'turf',
  turf_name: 'Green Park',
  overs_per_innings: 6,
  entry_fee: '500.00',
  min_teams: 4,
  max_teams: 8,
  start_date: '2026-11-02',
  status: 'REGISTRATION_OPEN',
  teams: 3,
  ...over,
});

describe('Tournaments list (mobile)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists tournaments that are taking entries, with fee and teams', async () => {
    getTournaments.mockResolvedValue({
      results: [t('1'), t('2', { status: 'IN_PROGRESS', entry_fee: '0.00' })],
    });
    const { findByTestId, queryByTestId, getByText } = await render(<TournamentsScreen />);

    expect(await findByTestId('tournament-1')).toBeTruthy();
    expect(getByText('Cup 1')).toBeTruthy();
    expect(getByText('3/8 teams · starts 2 Nov')).toBeTruthy();
    expect(getByText('₹500 entry')).toBeTruthy();
    expect(getByText('ENTRIES OPEN')).toBeTruthy();
    // the live one is on the Live tab
    expect(queryByTestId('tournament-2')).toBeNull();
  });

  it('switches between Open, Live and Finished', async () => {
    getTournaments.mockResolvedValue({
      results: [
        t('1'),
        t('2', { status: 'IN_PROGRESS', entry_fee: '0.00' }),
        t('3', { status: 'COMPLETED' }),
      ],
    });
    const { findByTestId, queryByTestId, getByTestId, getByText } = await render(
      <TournamentsScreen />,
    );
    await findByTestId('tournament-1');

    await fireEvent.press(getByTestId('tournaments-tab-live'));
    expect(getByTestId('tournament-2')).toBeTruthy();
    expect(getByText('Free entry')).toBeTruthy();
    expect(queryByTestId('tournament-1')).toBeNull();

    await fireEvent.press(getByTestId('tournaments-tab-done'));
    expect(getByTestId('tournament-3')).toBeTruthy();
  });

  it('opens a tournament', async () => {
    getTournaments.mockResolvedValue({ results: [t('1')] });
    const { findByTestId } = await render(<TournamentsScreen />);
    await fireEvent.press(await findByTestId('tournament-1'));
    expect(mockPush).toHaveBeenCalledWith('/tournament/1');
  });

  it('says so when there is nothing to enter', async () => {
    getTournaments.mockResolvedValue({ results: [] });
    const { findByTestId } = await render(<TournamentsScreen />);
    expect(await findByTestId('tournaments-empty')).toBeTruthy();
  });

  it('shows an error if the list cannot load', async () => {
    getTournaments.mockRejectedValue(new Error('network'));
    const { findByText } = await render(<TournamentsScreen />);
    expect(await findByText('Could not load tournaments.')).toBeTruthy();
  });
});
