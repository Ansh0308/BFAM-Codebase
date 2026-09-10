import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockCreateTeam = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    createTeam: (...args: unknown[]) => mockCreateTeam(...args),
  },
}));

import CreateTeamScreen from '../app/(tabs)/teams/create';

// Backlog A-11: "Create from existing team" — My Teams' copy action hands
// the old team's fields to Create Team via copyFrom* query params; this
// screen must prefill from them (still fully editable) rather than force a
// blank form.
describe('Create Team screen — copy from an existing team (backlog A-11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockCreateTeam.mockResolvedValue({ team_id: 'new-team-1' });
  });

  it('starts blank when reached with no copyFrom params', () => {
    const { getByTestId } = render(<CreateTeamScreen />);
    expect(getByTestId('team-name-input').props.value).toBe('');
  });

  it('prefills every field from copyFrom params, editable before saving', async () => {
    mockParams = {
      copyFromTeamName: 'Rajkot Strikers',
      copyFromDescription: 'The original squad',
      copyFromHomeCity: 'Rajkot',
      copyFromSkillLevel: 'ADVANCED',
      copyFromIsOpen: 'false',
    };

    const { getByTestId } = render(<CreateTeamScreen />);

    expect(getByTestId('team-name-input').props.value).toBe('Rajkot Strikers');

    // Edit the copied name before saving as a new team.
    fireEvent.changeText(getByTestId('team-name-input'), 'Rajkot Strikers II');
    fireEvent.press(getByTestId('submit-create-team'));

    await waitFor(() => {
      expect(mockCreateTeam).toHaveBeenCalledWith({
        team_name: 'Rajkot Strikers II',
        description: 'The original squad',
        home_city: 'Rajkot',
        skill_level: 'ADVANCED',
        is_open_for_players: false,
        min_skill_rating: null,
      });
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/teams/new-team-1');
  });

  // Backlog B-8: rating-gated team vacancies.
  describe('minimum skill rating', () => {
    it('sends the entered minimum skill rating', async () => {
      const { getByTestId } = render(<CreateTeamScreen />);

      fireEvent.changeText(getByTestId('team-name-input'), 'Elite XI');
      fireEvent.changeText(getByTestId('min-skill-rating-input'), '600');
      fireEvent.press(getByTestId('submit-create-team'));

      await waitFor(() =>
        expect(mockCreateTeam).toHaveBeenCalledWith(
          expect.objectContaining({ min_skill_rating: 600 }),
        ),
      );
    });

    it('hides the field when the team is not open for new players', () => {
      const { getByTestId, queryByTestId } = render(<CreateTeamScreen />);

      fireEvent.press(getByTestId('is-open-toggle-switch'));

      expect(queryByTestId('min-skill-rating-input')).toBeNull();
    });

    it('rejects a non-numeric minimum skill rating', async () => {
      const { getByTestId, findByText } = render(<CreateTeamScreen />);

      fireEvent.changeText(getByTestId('team-name-input'), 'Elite XI');
      fireEvent.changeText(getByTestId('min-skill-rating-input'), 'abc');
      fireEvent.press(getByTestId('submit-create-team'));

      await findByText(/whole number/i);
      expect(mockCreateTeam).not.toHaveBeenCalled();
    });
  });
});
