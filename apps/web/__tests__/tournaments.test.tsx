import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getTournaments: jest.fn(),
    getTournament: jest.fn(),
    createTournament: jest.fn(),
    updateTournament: jest.fn(),
    deleteTournament: jest.fn(),
    openTournamentRegistration: jest.fn(),
    cancelTournament: jest.fn(),
    startTournament: jest.fn(),
    startTournamentKnockout: jest.fn(),
    addTournamentTeam: jest.fn(),
    setTournamentSeeds: jest.fn(),
    reviewTournamentEntry: jest.fn(),
    setTournamentEntryPaid: jest.fn(),
    removeTournamentEntry: jest.fn(),
    recordTournamentResult: jest.fn(),
    reopenTournamentFixture: jest.fn(),
    searchTeams: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import { TournamentList } from '../src/components/tournaments/TournamentList';
import { TournamentView } from '../src/components/tournaments/TournamentView';

const api = apiClient as unknown as Record<string, jest.Mock>;

const tournament = (over: Record<string, unknown> = {}) => ({
  tournament_id: 't1',
  name: 'Diwali Cup',
  description: null,
  format: 'LEAGUE_KNOCKOUT',
  organiser_id: 'o1',
  turf_id: 'turf1',
  turf_name: 'Green Park',
  overs_per_innings: 6,
  entry_fee: '500.00',
  min_teams: 4,
  max_teams: 8,
  double_round: 0,
  start_date: '2026-11-01',
  registration_deadline: null,
  status: 'REGISTRATION_OPEN',
  champion_entry_id: null,
  champion_name: null,
  created_at: '2026-10-01T00:00:00Z',
  ...over,
});

describe('TournamentList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists tournaments with their stage, teams and fee', async () => {
    api.getTournaments.mockResolvedValue({
      results: [
        { ...tournament(), teams: 3 },
        {
          ...tournament({
            tournament_id: 't2',
            name: 'Free Bash',
            status: 'IN_PROGRESS',
            entry_fee: '0.00',
          }),
          teams: 8,
        },
      ],
    });
    render(<TournamentList basePath="/admin/tournaments" subtitle="s" />);
    expect(await screen.findByText('Diwali Cup')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-t1')).toHaveAttribute('href', '/admin/tournaments/t1');
    expect(screen.getByTestId('tournament-t1')).toHaveTextContent('3/8 teams');
    expect(screen.getByTestId('tournament-t1')).toHaveTextContent('Registration open');
    expect(screen.getByTestId('tournament-t2')).toHaveTextContent('Free entry');
  });

  it('filters by stage', async () => {
    api.getTournaments.mockResolvedValue({
      results: [
        { ...tournament(), teams: 3 },
        {
          ...tournament({ tournament_id: 't2', name: 'Live One', status: 'IN_PROGRESS' }),
          teams: 8,
        },
      ],
    });
    render(<TournamentList basePath="/x" subtitle="s" />);
    await screen.findByText('Diwali Cup');
    fireEvent.click(screen.getByTestId('tournament-filter-live'));
    expect(screen.queryByText('Diwali Cup')).toBeNull();
    expect(screen.getByText('Live One')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    api.getTournaments.mockResolvedValue({ results: [] });
    render(<TournamentList basePath="/x" subtitle="s" />);
    expect(await screen.findByTestId('tournaments-empty')).toBeInTheDocument();
  });

  it('creates a tournament (owner: hosted at one of their turfs)', async () => {
    api.getTournaments.mockResolvedValue({ results: [] });
    api.createTournament.mockResolvedValue(tournament());
    render(
      <TournamentList
        basePath="/owner/tournaments"
        subtitle="s"
        turfs={[{ turf_id: 'turf1', turf_name: 'Green Park' }]}
      />,
    );
    await screen.findByTestId('tournaments-empty');
    fireEvent.click(screen.getByTestId('new-tournament'));
    fireEvent.change(await screen.findByTestId('t-name'), { target: { value: 'Diwali Cup' } });
    fireEvent.change(screen.getByTestId('t-fee'), { target: { value: '500' } });
    fireEvent.click(screen.getByTestId('t-submit'));

    await waitFor(() =>
      expect(api.createTournament).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Diwali Cup',
          format: 'LEAGUE_KNOCKOUT',
          turf_id: 'turf1',
          entry_fee: 500,
          overs_per_innings: 6,
          min_teams: 4,
          max_teams: 8,
        }),
      ),
    );
  });

  it('validates before calling the server', async () => {
    api.getTournaments.mockResolvedValue({ results: [] });
    render(<TournamentList basePath="/x" subtitle="s" />);
    await screen.findByTestId('tournaments-empty');
    fireEvent.click(screen.getByTestId('new-tournament'));
    fireEvent.change(await screen.findByTestId('t-name'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByTestId('t-submit'));
    expect(await screen.findByTestId('t-error')).toHaveTextContent(/name/i);

    fireEvent.change(screen.getByTestId('t-name'), { target: { value: 'Valid Cup' } });
    fireEvent.change(screen.getByTestId('t-min'), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('t-submit'));
    expect(await screen.findByTestId('t-error')).toHaveTextContent(/minimum/i);
    expect(api.createTournament).not.toHaveBeenCalled();
  });
});

// ---- detail ------------------------------------------------------------------

const entry = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  entry_id: id,
  tournament_id: 't1',
  team_id: `team-${id}`,
  team_name: name,
  team_logo_url: null,
  registered_by: 'c1',
  registered_by_phone: '+919900000001',
  status: 'APPROVED',
  payment_status: 'UNPAID',
  payment_reference: null,
  paid_at: null,
  seed: null,
  registered_at: '2026-10-02T00:00:00Z',
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
  venue_note: null,
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
  next_match_number: null,
  ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  tournament: tournament(),
  can_manage: true,
  can_start_knockout: false,
  entries: [entry('ea', 'Alpha'), entry('eb', 'Bravo', { status: 'PENDING' })],
  fixtures: [],
  table: [],
  ...over,
});

describe('TournamentView — registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows teams with approval and payment status', async () => {
    api.getTournament.mockResolvedValue(detail());
    render(<TournamentView tournamentId="t1" backHref="/admin/tournaments" />);
    expect(await screen.findByTestId('entry-ea')).toHaveTextContent('Alpha');
    expect(screen.getByTestId('entry-ea')).toHaveTextContent('Unpaid');
    expect(screen.getByTestId('entry-eb')).toHaveTextContent('PENDING');
    expect(screen.getByTestId('entry-eb')).toHaveTextContent('+919900000001');
  });

  it('approves a pending team', async () => {
    api.getTournament.mockResolvedValue(detail());
    api.reviewTournamentEntry.mockResolvedValue({});
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.click(await screen.findByTestId('approve-eb'));
    await waitFor(() => expect(api.reviewTournamentEntry).toHaveBeenCalledWith('eb', 'APPROVED'));
  });

  it('records an entry fee as paid with a reference', async () => {
    api.getTournament.mockResolvedValue(detail());
    api.setTournamentEntryPaid.mockResolvedValue({});
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.click(await screen.findByTestId('pay-ea'));
    fireEvent.change(await screen.findByTestId('pay-reference'), { target: { value: 'UPI-77' } });
    fireEvent.click(screen.getByTestId('pay-confirm'));
    await waitFor(() =>
      expect(api.setTournamentEntryPaid).toHaveBeenCalledWith('ea', true, 'UPI-77'),
    );
  });

  it('searches for a team and adds it', async () => {
    api.getTournament.mockResolvedValue(detail());
    api.searchTeams.mockResolvedValue({
      results: [{ team_id: 'tm9', team_name: 'Zeta Kings', home_city: 'Rajkot' }],
    });
    api.addTournamentTeam.mockResolvedValue({});
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.change(await screen.findByTestId('team-search'), { target: { value: 'Zeta' } });
    fireEvent.click(screen.getByTestId('team-search-go'));
    fireEvent.click(await screen.findByTestId('add-tm9'));
    await waitFor(() => expect(api.addTournamentTeam).toHaveBeenCalledWith('t1', 'tm9'));
  });

  it('opens registration on a draft, and starts only after confirmation', async () => {
    api.getTournament.mockResolvedValue(detail({ tournament: tournament({ status: 'DRAFT' }) }));
    api.openTournamentRegistration.mockResolvedValue({});
    api.startTournament.mockResolvedValue({});
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.click(await screen.findByTestId('open-registration'));
    await waitFor(() => expect(api.openTournamentRegistration).toHaveBeenCalledWith('t1'));

    fireEvent.click(screen.getByTestId('start-tournament'));
    expect(api.startTournament).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(() => expect(api.startTournament).toHaveBeenCalledWith('t1'));
  });

  it('gives a visitor a read-only view', async () => {
    api.getTournament.mockResolvedValue(detail({ can_manage: false }));
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    await screen.findByTestId('entry-ea');
    for (const id of ['start-tournament', 'edit-tournament', 'approve-eb', 'add-team']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it('explains when the tournament cannot be opened', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.getTournament.mockRejectedValue(new BFAMApiError('Tournament not found.', 404));
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    expect(await screen.findByTestId('tournament-error')).toHaveTextContent(
      'Tournament not found.',
    );
  });
});

describe('TournamentView — running it', () => {
  const live = (over: Record<string, unknown> = {}) =>
    detail({
      tournament: tournament({ status: 'IN_PROGRESS' }),
      entries: [entry('ea', 'Alpha'), entry('eb', 'Bravo')],
      fixtures: [
        fixture(1),
        fixture(2, {
          team_a_name: 'Charlie',
          team_b_name: 'Delta',
          team_a_entry_id: 'ec',
          team_b_entry_id: 'ed',
        }),
      ],
      ...over,
    });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens on the fixtures and enters a league result with scores', async () => {
    api.getTournament.mockResolvedValue(live());
    api.recordTournamentResult.mockResolvedValue(undefined);
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.click(await screen.findByTestId('enter-result-1'));

    fireEvent.click(await screen.findByTestId('winner-a'));
    fireEvent.change(screen.getByTestId('a-runs'), { target: { value: '60' } });
    fireEvent.change(screen.getByTestId('a-overs'), { target: { value: '5.3' } });
    fireEvent.change(screen.getByTestId('b-runs'), { target: { value: '52' } });
    fireEvent.change(screen.getByTestId('b-overs'), { target: { value: '6' } });
    fireEvent.click(screen.getByTestId('result-submit'));

    await waitFor(() =>
      expect(api.recordTournamentResult).toHaveBeenCalledWith(
        'f1',
        expect.objectContaining({
          result_type: 'WIN',
          winner_entry_id: 'ea',
          team_a_runs: 60,
          team_a_overs: 5.3,
          team_b_runs: 52,
          team_b_overs: 6,
        }),
      ),
    );
  });

  it('asks for a winner and for scores before saving a league result', async () => {
    api.getTournament.mockResolvedValue(live());
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.click(await screen.findByTestId('enter-result-1'));
    fireEvent.click(await screen.findByTestId('result-submit'));
    expect(await screen.findByTestId('result-error')).toHaveTextContent(/which team won/i);

    fireEvent.click(screen.getByTestId('winner-b'));
    fireEvent.click(screen.getByTestId('result-submit'));
    expect(await screen.findByTestId('result-error')).toHaveTextContent(/net run rate/i);
    expect(api.recordTournamentResult).not.toHaveBeenCalled();
  });

  it('refuses more overs than the innings allows or a bad ball count', async () => {
    api.getTournament.mockResolvedValue(live());
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.click(await screen.findByTestId('enter-result-1'));
    fireEvent.click(await screen.findByTestId('winner-a'));
    for (const [id, v] of [
      ['a-runs', '50'],
      ['b-runs', '40'],
      ['b-overs', '6'],
      ['a-overs', '7'],
    ]) {
      fireEvent.change(screen.getByTestId(id), { target: { value: v } });
    }
    fireEvent.click(screen.getByTestId('result-submit'));
    expect(await screen.findByTestId('result-error')).toHaveTextContent(/can’t exceed 6/);

    fireEvent.change(screen.getByTestId('a-overs'), { target: { value: '5.7' } });
    fireEvent.click(screen.getByTestId('result-submit'));
    expect(await screen.findByTestId('result-error')).toHaveTextContent(/5\.3/);
  });

  it('a no-result needs neither winner nor scores', async () => {
    api.getTournament.mockResolvedValue(live());
    api.recordTournamentResult.mockResolvedValue(undefined);
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.click(await screen.findByTestId('enter-result-1'));
    fireEvent.click(await screen.findByTestId('result-type-NO_RESULT'));
    fireEvent.click(screen.getByTestId('result-submit'));
    await waitFor(() =>
      expect(api.recordTournamentResult).toHaveBeenCalledWith(
        'f1',
        expect.objectContaining({ result_type: 'NO_RESULT', winner_entry_id: null }),
      ),
    );
  });

  it('a knockout match always needs someone to go through', async () => {
    api.getTournament.mockResolvedValue(
      live({ fixtures: [fixture(5, { stage: 'KNOCKOUT', stage_label: 'Semi-final' })] }),
    );
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.click(await screen.findByTestId('enter-result-5'));
    fireEvent.click(await screen.findByTestId('result-type-TIE'));
    fireEvent.click(screen.getByTestId('result-submit'));
    expect(await screen.findByTestId('result-error')).toHaveTextContent(/super over/i);
  });

  it('shows a finished match and lets the organiser reopen it', async () => {
    api.getTournament.mockResolvedValue(
      live({
        fixtures: [
          fixture(1, {
            status: 'COMPLETED',
            result_type: 'WIN',
            winner_entry_id: 'ea',
            winner_name: 'Alpha',
            team_a_runs: 60,
            team_a_wickets: 3,
            team_a_overs: 5.3,
            team_b_runs: 52,
            team_b_overs: 6,
          }),
        ],
      }),
    );
    api.reopenTournamentFixture.mockResolvedValue(undefined);
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    expect(await screen.findByTestId('result-1')).toHaveTextContent('Alpha won');
    expect(screen.getByTestId('fixture-1')).toHaveTextContent('60/3 (5.3)');
    fireEvent.click(screen.getByTestId('reopen-1'));
    await waitFor(() => expect(api.reopenTournamentFixture).toHaveBeenCalledWith('f1'));
  });

  it('shows the points table with the qualifying teams marked', async () => {
    const row = (rank: number, name: string, pts: number, nrr: number) => ({
      team_id: `e${rank}`,
      name,
      rank,
      played: 3,
      won: pts / 2,
      lost: 3 - pts / 2,
      tied: 0,
      no_result: 0,
      points: pts,
      runs_for: 0,
      overs_for: 0,
      runs_against: 0,
      overs_against: 0,
      nrr,
    });
    api.getTournament.mockResolvedValue(
      live({
        entries: ['A', 'B', 'C', 'D', 'E'].map((n, i) => entry(`e${i + 1}`, `Team ${n}`)),
        table: [
          row(1, 'Team A', 6, 1.25),
          row(2, 'Team B', 4, 0.1),
          row(3, 'Team C', 2, -0.4),
          row(4, 'Team D', 2, -0.9),
          row(5, 'Team E', 0, -2),
        ],
      }),
    );
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.click(await screen.findByTestId('tournament-tab-table'));
    const table = await screen.findByTestId('points-table');
    expect(within(table).getByTestId('row-1')).toHaveTextContent('Team A');
    expect(within(table).getByTestId('row-1')).toHaveTextContent('+1.250');
    expect(within(table).getByTestId('row-5')).toHaveTextContent('-2.000');
    expect(within(table).getByTestId('row-4').className).toMatch(/brand-red/);
    expect(within(table).getByTestId('row-5').className).not.toMatch(/brand-red/);
  });

  it('offers the knockout once the league is done', async () => {
    api.getTournament.mockResolvedValue(live({ can_start_knockout: true }));
    api.startTournamentKnockout.mockResolvedValue({});
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    fireEvent.click(await screen.findByTestId('start-knockout'));
    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(() => expect(api.startTournamentKnockout).toHaveBeenCalledWith('t1'));
  });

  it('draws the bracket and names the champions', async () => {
    api.getTournament.mockResolvedValue(
      live({
        tournament: tournament({
          status: 'COMPLETED',
          champion_entry_id: 'ea',
          champion_name: 'Alpha',
        }),
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
    render(<TournamentView tournamentId="t1" backHref="/b" />);
    expect(await screen.findByTestId('champion-banner')).toHaveTextContent('Alpha');
    fireEvent.click(screen.getByTestId('tournament-tab-bracket'));
    const bracket = await screen.findByTestId('bracket');
    expect(bracket).toHaveTextContent('Semi-final');
    expect(bracket).toHaveTextContent('Final');
    expect(bracket).toHaveTextContent('To be decided');
  });
});
