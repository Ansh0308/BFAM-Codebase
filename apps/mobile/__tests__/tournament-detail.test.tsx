import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getTournament: jest.fn(),
    getMyTeams: jest.fn(),
    registerTournamentTeam: jest.fn(),
    removeTournamentEntry: jest.fn(),
    payTournamentEntry: jest.fn(),
  },
}));

const mockConfirm = jest.fn();
jest.mock('../src/lib/confirm', () => ({
  confirmAction: (...args: unknown[]) => mockConfirm(...args),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ tournamentId: 't1' }),
}));

const mockOpen = jest.fn();
jest.mock(
  'react-native-razorpay',
  () => ({ default: { open: (...a: unknown[]) => mockOpen(...a) } }),
  { virtual: true },
);

import TournamentScreen from '../app/tournament/[tournamentId]';

const api = apiClient as unknown as Record<string, jest.Mock>;

const tournament = (over: Record<string, unknown> = {}) => ({
  tournament_id: 't1',
  name: 'Diwali Cup',
  description: 'Six-over box cricket.',
  format: 'LEAGUE_KNOCKOUT',
  organiser_id: 'host',
  turf_id: 'turf',
  turf_name: 'Green Park',
  overs_per_innings: 6,
  entry_fee: '500.00',
  min_teams: 4,
  max_teams: 8,
  start_date: '2026-11-02',
  registration_deadline: null,
  status: 'REGISTRATION_OPEN',
  champion_entry_id: null,
  champion_name: null,
  ...over,
});
const entry = (id: string, team: string, name: string, over: Record<string, unknown> = {}) => ({
  entry_id: id,
  tournament_id: 't1',
  team_id: team,
  team_name: name,
  status: 'APPROVED',
  payment_status: 'UNPAID',
  payment_reference: null,
  payment_id: null,
  registered_by_phone: null,
  ...over,
});
const fixture = (n: number, over: Record<string, unknown> = {}) => ({
  fixture_id: `f${n}`,
  tournament_id: 't1',
  stage: 'LEAGUE',
  stage_label: 'Round 1 of 3',
  round_number: 1,
  match_number: n,
  team_a_entry_id: 'ea',
  team_b_entry_id: 'eb',
  team_a_name: 'Alpha',
  team_b_name: 'Bravo',
  scheduled_at: null,
  status: 'SCHEDULED',
  result_type: null,
  winner_entry_id: null,
  winner_name: null,
  team_a_runs: null,
  team_a_wickets: null,
  team_a_overs: null,
  team_b_runs: null,
  team_b_wickets: null,
  team_b_overs: null,
  match_id: null,
  match_status: null,
  ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  tournament: tournament(),
  can_manage: false,
  is_host: false,
  can_start_knockout: false,
  entries: [entry('ea', 'team-a', 'Alpha')],
  fixtures: [],
  table: [],
  ...over,
});
const myTeam = (id: string, name: string, role = 'CAPTAIN') => ({
  team_id: id,
  team_name: name,
  role_in_team: role,
});

describe('Tournament detail (mobile)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getMyTeams.mockResolvedValue({ results: [] });
  });

  it('shows the fee, stage and accepted teams', async () => {
    api.getTournament.mockResolvedValue(detail());
    const { findByTestId, getByText, getByTestId } = await render(<TournamentScreen />);
    expect(await findByTestId('tournament-fee')).toBeTruthy();
    expect(getByText('₹500 entry')).toBeTruthy();
    expect(getByText('ENTRIES OPEN')).toBeTruthy();
    expect(getByTestId('team-ea')).toBeTruthy();
  });

  it('lets a captain enter their team', async () => {
    api.getTournament.mockResolvedValue(detail());
    api.getMyTeams.mockResolvedValue({ results: [myTeam('team-z', 'Zeta Kings')] });
    api.registerTournamentTeam.mockResolvedValue({});
    const { findByTestId, findByText } = await render(<TournamentScreen />);
    await fireEvent.press(await findByTestId('enter-team'));
    await waitFor(() => expect(api.registerTournamentTeam).toHaveBeenCalledWith('t1', 'team-z'));
    expect(await findByText(/Zeta Kings has been entered/)).toBeTruthy();
  });

  it('lets a captain of several teams choose which to enter', async () => {
    api.getTournament.mockResolvedValue(detail());
    api.getMyTeams.mockResolvedValue({
      results: [myTeam('team-y', 'Yankees'), myTeam('team-z', 'Zeta Kings')],
    });
    api.registerTournamentTeam.mockResolvedValue({});
    const { findByTestId } = await render(<TournamentScreen />);
    await fireEvent.press(await findByTestId('enter-team'));
    await fireEvent.press(await findByTestId('enter-team-z'));
    await waitFor(() => expect(api.registerTournamentTeam).toHaveBeenCalledWith('t1', 'team-z'));
  });

  it('only a captain can enter, so a member is told so', async () => {
    api.getTournament.mockResolvedValue(detail());
    api.getMyTeams.mockResolvedValue({ results: [myTeam('team-z', 'Zeta Kings', 'MEMBER')] });
    const { findByTestId, queryByTestId } = await render(<TournamentScreen />);
    expect(await findByTestId('not-captain')).toBeTruthy();
    expect(queryByTestId('enter-team-card')).toBeNull();
  });

  it('shows the state of your own entry and its fee', async () => {
    api.getTournament.mockResolvedValue(
      detail({ entries: [entry('ez', 'team-z', 'Zeta Kings', { status: 'PENDING' })] }),
    );
    api.getMyTeams.mockResolvedValue({ results: [myTeam('team-z', 'Zeta Kings')] });
    const { findByTestId, queryByTestId, getByText } = await render(<TournamentScreen />);
    expect(await findByTestId('my-entry-ez')).toBeTruthy();
    expect(getByText('WAITING FOR APPROVAL')).toBeTruthy();
    expect(await findByTestId('pay-upi-ez')).toBeTruthy();
    // already entered, so the enter card is gone
    expect(queryByTestId('enter-team-card')).toBeNull();
  });

  it('pays the entry fee through Razorpay, like a turf booking', async () => {
    api.getMyTeams.mockResolvedValue({ results: [myTeam('team-z', 'Zeta Kings')] });
    api.getTournament
      .mockResolvedValueOnce(detail({ entries: [entry('ez', 'team-z', 'Zeta Kings')] }))
      .mockResolvedValue(
        detail({
          entries: [
            entry('ez', 'team-z', 'Zeta Kings', { payment_status: 'PAID', payment_id: 'p1' }),
          ],
        }),
      );
    api.payTournamentEntry.mockResolvedValue({
      payment_id: 'p1',
      order_id: 'order_1',
      amount: 500,
      currency: 'INR',
      key_id: 'rzp_test',
      entry_id: 'ez',
    });
    mockOpen.mockResolvedValue({});
    const { findByTestId, findByText } = await render(<TournamentScreen />);

    await fireEvent.press(await findByTestId('pay-upi-ez'));
    await waitFor(() => expect(api.payTournamentEntry).toHaveBeenCalledWith('ez', 'UPI'));
    await waitFor(() =>
      expect(mockOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'rzp_test',
          order_id: 'order_1',
          amount: 50000,
          currency: 'INR',
        }),
      ),
    );
    expect(
      await findByText('Entry fee paid. See you on the pitch!', {}, { timeout: 6000 }),
    ).toBeTruthy();
  });

  it('can pay with the gateway option too, and shows why a payment failed', async () => {
    api.getMyTeams.mockResolvedValue({ results: [myTeam('team-z', 'Zeta Kings')] });
    api.getTournament.mockResolvedValue(detail({ entries: [entry('ez', 'team-z', 'Zeta Kings')] }));
    api.payTournamentEntry.mockResolvedValue({
      payment_id: 'p',
      order_id: 'o',
      amount: 500,
      currency: 'INR',
      key_id: 'k',
      entry_id: 'ez',
    });
    mockOpen.mockRejectedValue({ description: 'Payment cancelled' });
    const { findByTestId, findByText } = await render(<TournamentScreen />);
    await fireEvent.press(await findByTestId('pay-gateway-ez'));
    await waitFor(() => expect(api.payTournamentEntry).toHaveBeenCalledWith('ez', 'RAZORPAY'));
    expect(await findByText('Payment cancelled')).toBeTruthy();
  });

  it('shows a paid entry as paid, with no pay buttons', async () => {
    api.getMyTeams.mockResolvedValue({ results: [myTeam('team-z', 'Zeta Kings')] });
    api.getTournament.mockResolvedValue(
      detail({ entries: [entry('ez', 'team-z', 'Zeta Kings', { payment_status: 'PAID' })] }),
    );
    const { findByTestId, queryByTestId } = await render(<TournamentScreen />);
    expect(await findByTestId('entry-paid-ez')).toBeTruthy();
    expect(queryByTestId('pay-upi-ez')).toBeNull();
  });

  it('withdraws a team only after confirmation', async () => {
    mockConfirm.mockResolvedValue(true);
    api.getMyTeams.mockResolvedValue({ results: [myTeam('team-z', 'Zeta Kings')] });
    api.getTournament.mockResolvedValue(detail({ entries: [entry('ez', 'team-z', 'Zeta Kings')] }));
    api.removeTournamentEntry.mockResolvedValue(undefined);
    const { findByTestId } = await render(<TournamentScreen />);
    await fireEvent.press(await findByTestId('withdraw-ez'));
    await waitFor(() => expect(api.removeTournamentEntry).toHaveBeenCalledWith('ez'));

    mockConfirm.mockResolvedValue(false);
    api.removeTournamentEntry.mockClear();
    await fireEvent.press(await findByTestId('withdraw-ez'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.removeTournamentEntry).not.toHaveBeenCalled();
  });

  it('once it has started there is nothing left to enter or pay', async () => {
    api.getMyTeams.mockResolvedValue({ results: [myTeam('team-z', 'Zeta Kings')] });
    api.getTournament.mockResolvedValue(
      detail({
        tournament: tournament({ status: 'IN_PROGRESS' }),
        entries: [entry('ez', 'team-z', 'Zeta Kings')],
        fixtures: [fixture(1)],
      }),
    );
    const { findByTestId, queryByTestId } = await render(<TournamentScreen />);
    await findByTestId('fixture-1');
    expect(queryByTestId('enter-team-card')).toBeNull();
    expect(queryByTestId('pay-upi-ez')).toBeNull();
    expect(queryByTestId('withdraw-ez')).toBeNull();
  });

  it('shows a clear message when the tournament is not found', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.getTournament.mockRejectedValue(new BFAMApiError('Tournament not found.', 404));
    const { findByText } = await render(<TournamentScreen />);
    expect(await findByText('Tournament not found.')).toBeTruthy();
  });
});

describe('Tournament detail: fixtures, table and bracket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getMyTeams.mockResolvedValue({ results: [] });
  });
  const running = (over: Record<string, unknown> = {}) =>
    detail({
      tournament: tournament({ status: 'IN_PROGRESS' }),
      entries: [entry('ea', 'a', 'Alpha'), entry('eb', 'b', 'Bravo')],
      ...over,
    });

  it('opens on the fixtures and shows a finished match with its result', async () => {
    api.getTournament.mockResolvedValue(
      running({
        fixtures: [
          fixture(1, {
            status: 'COMPLETED',
            result_type: 'WIN',
            winner_entry_id: 'ea',
            winner_name: 'Alpha',
            team_a_runs: 61,
            team_a_wickets: 2,
            team_a_overs: 6,
            team_b_runs: 48,
            team_b_overs: 5.3,
          }),
        ],
      }),
    );
    const { findByTestId, getByText } = await render(<TournamentScreen />);
    expect((await findByTestId('result-1')).props.children).toBe('Alpha won');
    expect(getByText('61/2 (6)')).toBeTruthy();
  });

  it('lets anyone watch a live match', async () => {
    api.getTournament.mockResolvedValue(
      running({ fixtures: [fixture(1, { match_id: 'm9', match_status: 'IN_PROGRESS' })] }),
    );
    const { findByTestId } = await render(<TournamentScreen />);
    await fireEvent.press(await findByTestId('watch-1'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/m9/live');
  });

  it('shows the points table', async () => {
    const row = (rank: number, name: string, pts: number) => ({
      team_id: `e${rank}`,
      name,
      rank,
      played: 3,
      won: pts / 2,
      lost: 3 - pts / 2,
      points: pts,
      nrr: 1.2 - rank,
    });
    api.getTournament.mockResolvedValue(
      running({ fixtures: [fixture(1)], table: [row(1, 'Alpha', 6), row(2, 'Bravo', 2)] }),
    );
    const { findByTestId, getByTestId, getByText } = await render(<TournamentScreen />);
    await fireEvent.press(await findByTestId('tournament-tab-table'));
    expect(getByTestId('points-table')).toBeTruthy();
    expect(getByTestId('row-1')).toBeTruthy();
    expect(getByText('Alpha')).toBeTruthy();
    expect(getByText('+0.20')).toBeTruthy();
  });

  it('draws the bracket by round', async () => {
    api.getTournament.mockResolvedValue(
      running({
        fixtures: [
          fixture(7, { stage: 'KNOCKOUT', stage_label: 'Semi-final', round_number: 1 }),
          fixture(9, {
            stage: 'KNOCKOUT',
            stage_label: 'Final',
            round_number: 2,
            team_b_entry_id: null,
            team_b_name: null,
          }),
        ],
      }),
    );
    const { findByTestId, getAllByText, getByText } = await render(<TournamentScreen />);
    await fireEvent.press(await findByTestId('tournament-tab-bracket'));
    expect(getAllByText(/semi-final/i).length).toBeGreaterThan(0);
    expect(getAllByText(/^final$/i).length).toBeGreaterThan(0);
    expect(getByText('To be decided')).toBeTruthy();
  });

  it('tells players when a knockout match ended level and the host is deciding', async () => {
    api.getTournament.mockResolvedValue(
      running({
        fixtures: [
          fixture(5, {
            stage: 'KNOCKOUT',
            stage_label: 'Semi-final',
            match_id: 'm5',
            match_status: 'COMPLETED',
          }),
        ],
      }),
    );
    const { findByTestId, queryByTestId } = await render(<TournamentScreen />);
    expect(await findByTestId('tie-5')).toBeTruthy();
    // a finished match is not "live", so there is nothing to watch
    expect(queryByTestId('watch-5')).toBeNull();
  });

  it('names the champions', async () => {
    api.getTournament.mockResolvedValue(
      running({
        tournament: tournament({ status: 'COMPLETED', champion_name: 'Alpha' }),
        fixtures: [fixture(1)],
      }),
    );
    const { findByTestId } = await render(<TournamentScreen />);
    expect(await findByTestId('champion-card')).toBeTruthy();
  });
});
