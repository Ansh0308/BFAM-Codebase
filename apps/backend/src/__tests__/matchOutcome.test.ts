import {
  computeMatchOutcome,
  pickPlayerOfTheMatch,
  wicketsToEndInnings,
} from '../domain/matchOutcome';

const A = 'team-a';
const B = 'team-b';
const inn = (n: number, team: string, runs: number, wickets: number) => ({
  innings_number: n,
  batting_match_team_id: team,
  total_runs: runs,
  total_wickets: wickets,
});

describe('wicketsToEndInnings', () => {
  it('is size - 1 with a non-striker and size in single-batter mode', () => {
    expect(wicketsToEndInnings(6, false)).toBe(5);
    expect(wicketsToEndInnings(6, true)).toBe(6);
  });
});

describe('computeMatchOutcome', () => {
  it('first batting side wins by runs when the chase falls short', () => {
    expect(
      computeMatchOutcome([inn(1, A, 100, 5), inn(2, B, 90, 8)], {
        battingTeamSize: 8,
        noNonStriker: false,
      }),
    ).toEqual({ result_type: 'WIN', winning_match_team_id: A, winning_margin: '10 runs' });
  });

  it('chasing side wins by wickets remaining', () => {
    expect(
      computeMatchOutcome([inn(1, A, 50, 3), inn(2, B, 51, 2)], {
        battingTeamSize: 6,
        noNonStriker: false,
      }),
    ).toEqual({ result_type: 'WIN', winning_match_team_id: B, winning_margin: '3 wickets' });
  });

  it('counts one extra wicket in single-batter mode', () => {
    expect(
      computeMatchOutcome([inn(1, A, 50, 3), inn(2, B, 51, 2)], {
        battingTeamSize: 6,
        noNonStriker: true,
      }).winning_margin,
    ).toBe('4 wickets');
  });

  it('uses the singular for one run / one wicket and never reports 0 wickets', () => {
    expect(
      computeMatchOutcome([inn(1, A, 51, 3), inn(2, B, 50, 4)], {
        battingTeamSize: 6,
        noNonStriker: false,
      }).winning_margin,
    ).toBe('1 run');
    expect(
      computeMatchOutcome([inn(1, A, 50, 3), inn(2, B, 51, 5)], {
        battingTeamSize: 6,
        noNonStriker: false,
      }).winning_margin,
    ).toBe('1 wicket');
  });

  it('omits a wicket margin when the team size is unknown', () => {
    expect(
      computeMatchOutcome([inn(1, A, 50, 3), inn(2, B, 60, 2)], {
        battingTeamSize: null,
        noNonStriker: false,
      }),
    ).toEqual({ result_type: 'WIN', winning_match_team_id: B, winning_margin: null });
  });

  it('is a tie on equal scores and no result with fewer than two innings', () => {
    expect(
      computeMatchOutcome([inn(1, A, 70, 3), inn(2, B, 70, 6)], {
        battingTeamSize: 6,
        noNonStriker: false,
      }).result_type,
    ).toBe('TIE');
    expect(
      computeMatchOutcome([inn(1, A, 70, 3)], { battingTeamSize: 6, noNonStriker: false })
        .result_type,
    ).toBe('NO_RESULT');
  });

  it('orders innings by number regardless of input order', () => {
    expect(
      computeMatchOutcome([inn(2, B, 90, 8), inn(1, A, 100, 5)], {
        battingTeamSize: 8,
        noNonStriker: false,
      }).winning_match_team_id,
    ).toBe(A);
  });
});

describe('pickPlayerOfTheMatch', () => {
  const c = (id: string, runs: number, wickets: number, team: string) => ({
    player_id: id,
    runs,
    wickets,
    match_team_id: team,
  });

  it('weighs a wicket as 20 runs', () => {
    expect(pickPlayerOfTheMatch([c('bat', 45, 0, A), c('bowl', 0, 3, B)], null)).toBe('bowl');
  });

  it('breaks a points tie in favour of the winning side, then wickets', () => {
    expect(pickPlayerOfTheMatch([c('x', 20, 0, A), c('y', 20, 0, B)], B)).toBe('y');
    expect(pickPlayerOfTheMatch([c('x', 20, 0, A), c('y', 0, 1, A)], A)).toBe('y');
  });

  it('returns null when nobody contributed', () => {
    expect(pickPlayerOfTheMatch([c('x', 0, 0, A)], A)).toBeNull();
    expect(pickPlayerOfTheMatch([], null)).toBeNull();
  });
});
