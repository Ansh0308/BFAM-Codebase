import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getGameRoom: jest.fn(),
    getBalancedTeams: jest.fn(),
    updateMatchSetup: jest.fn(),
    assignPlayerSides: jest.fn(),
  },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
}));

const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;
const mockBalance = apiClient.getBalancedTeams as jest.Mock;
const mockUpdate = apiClient.updateMatchSetup as jest.Mock;
const mockAssign = apiClient.assignPlayerSides as jest.Mock;

import MatchSetupScreen from '../app/(tabs)/matches/[matchId]/setup';

const ROOM = {
  match_id: 'match-1',
  overs_per_innings: 6,
  no_non_striker: true,
  extras_count_toward_score: true,
  match_teams: [
    { match_team_id: 'mt-a', side_label: 'TEAM_A', team_name: null },
    { match_team_id: 'mt-b', side_label: 'TEAM_B', team_name: null },
  ],
  players: [
    {
      player_id: 'p1',
      bfam_id: 'BF1',
      full_name: 'Asha',
      invitation_status: 'CONFIRMED',
      match_team_id: null,
    },
    {
      player_id: 'p2',
      bfam_id: 'BF2',
      full_name: 'Ravi',
      invitation_status: 'PENDING',
      match_team_id: null,
    },
    {
      player_id: 'p3',
      bfam_id: 'BF3',
      full_name: 'Out',
      invitation_status: 'CANT_PLAY',
      match_team_id: null,
    },
  ],
};

// Match revamp: teams are named and populated BEFORE the toss.
describe('Match Setup screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockUpdate.mockResolvedValue({ matchTeams: [] });
    mockAssign.mockResolvedValue({ players: [] });
  });

  it('lists everyone who has not said they cannot play, and blocks Start until all are placed', async () => {
    const { findByTestId, queryByTestId, getByTestId } = await render(<MatchSetupScreen />);
    expect(await findByTestId('setup-player-p1')).toBeTruthy();
    expect(getByTestId('setup-player-p2')).toBeTruthy();
    expect(queryByTestId('setup-player-p3')).toBeNull(); // CANT_PLAY

    await fireEvent.press(getByTestId('setup-start-button'));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(getByTestId('setup-hint').props.children).toMatch(/every player on a team/i);
  });

  it('saves names, overs and rules, assigns sides, then moves on to the intro', async () => {
    const { findByTestId, getByTestId } = await render(<MatchSetupScreen />);
    await findByTestId('setup-player-p1');

    await fireEvent.changeText(getByTestId('team-name-TEAM_A'), 'Royals');
    await fireEvent.changeText(getByTestId('team-name-TEAM_B'), 'Owls');
    await fireEvent.press(getByTestId('assign-p1-TEAM_A'));
    await fireEvent.press(getByTestId('assign-p2-TEAM_B'));
    await fireEvent.press(getByTestId('overs-chip-10'));
    await fireEvent(getByTestId('rule-single-batter'), 'valueChange', false);
    await fireEvent(getByTestId('rule-extras'), 'valueChange', false);

    expect(getByTestId('team-count-TEAM_A').props.children).toBe(1);
    await fireEvent.press(getByTestId('setup-start-button'));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith('match-1', {
        team_names: [
          { match_team_id: 'mt-a', team_name: 'Royals' },
          { match_team_id: 'mt-b', team_name: 'Owls' },
        ],
        overs_per_innings: 10,
        no_non_striker: false,
        extras_count_toward_score: false,
      }),
    );
    expect(mockAssign).toHaveBeenCalledWith('match-1', [
      { player_id: 'p1', match_team_id: 'mt-a' },
      { player_id: 'p2', match_team_id: 'mt-b' },
    ]);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/matches/match-1/intro'));
  });

  it('Balance teams applies the skill-balanced suggestion', async () => {
    mockBalance.mockResolvedValue({
      team_a: [{ player_id: 'p2' }],
      team_b: [{ player_id: 'p1' }],
      strength_a: 500,
      strength_b: 500,
    });
    const { findByTestId, getByTestId } = await render(<MatchSetupScreen />);
    await findByTestId('setup-player-p1');

    await fireEvent.press(getByTestId('auto-balance'));
    await waitFor(() => expect(getByTestId('team-count-TEAM_A').props.children).toBe(1));
    expect(getByTestId('team-count-TEAM_B').props.children).toBe(1);

    await fireEvent.press(getByTestId('setup-start-button'));
    await waitFor(() =>
      expect(mockAssign).toHaveBeenCalledWith('match-1', [
        { player_id: 'p1', match_team_id: 'mt-b' },
        { player_id: 'p2', match_team_id: 'mt-a' },
      ]),
    );
  });

  it('starts from the match’s current settings (existing sides, overs, rules)', async () => {
    mockGetGameRoom.mockResolvedValue({
      ...ROOM,
      overs_per_innings: 8,
      no_non_striker: false,
      players: ROOM.players.map((p) => ({
        ...p,
        match_team_id: p.player_id === 'p1' ? 'mt-a' : 'mt-b',
      })),
    });
    const { findByTestId, getByTestId } = await render(<MatchSetupScreen />);
    await findByTestId('setup-player-p1');
    expect(getByTestId('overs-value').props.children).toBe(8);
    expect(getByTestId('rule-single-batter').props.value).toBe(false);
    expect(getByTestId('team-count-TEAM_A').props.children).toBe(1);
  });

  it('shows the server error and stays put when saving fails', async () => {
    mockUpdate.mockRejectedValue(new Error('boom'));
    const { findByTestId, getByTestId } = await render(<MatchSetupScreen />);
    await findByTestId('setup-player-p1');
    await fireEvent.press(getByTestId('assign-p1-TEAM_A'));
    await fireEvent.press(getByTestId('assign-p2-TEAM_B'));
    await fireEvent.press(getByTestId('setup-start-button'));
    expect(await findByTestId('setup-error-message')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
