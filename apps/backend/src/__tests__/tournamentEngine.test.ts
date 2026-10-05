import {
  ballsFromOvers,
  computePointsTable,
  generateKnockout,
  generateRoundRobin,
  isBye,
  knockoutQualifiers,
  oversFromBalls,
  roundName,
  type ResultFixture,
} from '../domain/tournamentEngine';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

describe('round robin', () => {
  it.each([2, 3, 4, 5, 6, 8])('every pair meets exactly once with %i teams', (n) => {
    const fixtures = generateRoundRobin(ids(n));
    expect(fixtures).toHaveLength((n * (n - 1)) / 2);
    const pairs = new Set(fixtures.map((f) => [f.team_a_id, f.team_b_id].sort().join('-')));
    expect(pairs.size).toBe(fixtures.length);
  });

  it('never has a team playing twice in a round', () => {
    for (const n of [4, 5, 6, 7]) {
      const byRound = new Map<number, string[]>();
      for (const f of generateRoundRobin(ids(n))) {
        const list = byRound.get(f.round_number) ?? [];
        list.push(f.team_a_id as string, f.team_b_id as string);
        byRound.set(f.round_number, list);
      }
      for (const teams of byRound.values()) expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it('gives every team a rest round when the field is odd', () => {
    const fixtures = generateRoundRobin(ids(5));
    const rounds = new Set(fixtures.map((f) => f.round_number));
    expect(rounds.size).toBe(5);
    for (const team of ids(5)) {
      const playing = new Set(
        fixtures
          .filter((f) => f.team_a_id === team || f.team_b_id === team)
          .map((f) => f.round_number),
      );
      expect(playing.size).toBe(4);
    }
  });

  it('plays both legs when asked, with sides reversed', () => {
    const fixtures = generateRoundRobin(ids(4), true);
    expect(fixtures).toHaveLength(12);
    const first = fixtures[0];
    const reverse = fixtures.find(
      (f) => f.team_a_id === first.team_b_id && f.team_b_id === first.team_a_id,
    );
    expect(reverse).toBeDefined();
    expect(reverse!.round_number).toBeGreaterThan(first.round_number);
  });

  it('numbers matches 1..n in order and returns nothing for under two teams', () => {
    expect(generateRoundRobin(ids(4)).map((f) => f.match_number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(generateRoundRobin(['solo'])).toEqual([]);
  });
});

describe('knockout bracket', () => {
  it('builds a full bracket for a power-of-two field', () => {
    const f = generateKnockout(ids(8));
    expect(f).toHaveLength(7); // 4 + 2 + 1
    expect(f.filter((x) => x.round_number === 1)).toHaveLength(4);
    expect(f.filter((x) => isBye(x))).toHaveLength(0);
  });

  it('seeds 1 v 8, 4 v 5, 2 v 7, 3 v 6 so the top seeds meet late', () => {
    const r1 = generateKnockout(ids(8)).filter((x) => x.round_number === 1);
    expect(r1.map((x) => [x.team_a_id, x.team_b_id])).toEqual([
      ['t1', 't8'],
      ['t4', 't5'],
      ['t2', 't7'],
      ['t3', 't6'],
    ]);
  });

  it('gives byes to the top seeds in an awkward field', () => {
    const f = generateKnockout(ids(6)); // bracket of 8: seeds 7 and 8 missing
    const byes = f.filter((x) => isBye(x));
    expect(byes).toHaveLength(2);
    expect(byes.map((b) => b.team_a_id ?? b.team_b_id).sort()).toEqual(['t1', 't2']);
  });

  it('routes each winner into the next round, alternating slots', () => {
    const f = generateKnockout(ids(4));
    const [s1, s2, final] = f;
    expect(s1.next_match_number).toBe(final.match_number);
    expect(s1.next_slot).toBe('A');
    expect(s2.next_match_number).toBe(final.match_number);
    expect(s2.next_slot).toBe('B');
    expect(final.next_match_number).toBeNull();
  });

  it('can continue numbering after the league fixtures', () => {
    const f = generateKnockout(ids(4), 7);
    expect(f.map((x) => x.match_number)).toEqual([7, 8, 9]);
    expect(f[0].next_match_number).toBe(9);
  });

  it('names the rounds from the final backwards', () => {
    expect([1, 2, 3].map((r) => roundName(r, 3))).toEqual(['Quarter-final', 'Semi-final', 'Final']);
    expect(roundName(1, 4)).toBe('Round 1');
  });
});

describe('overs notation', () => {
  it('converts both ways', () => {
    expect(ballsFromOvers(5.3)).toBe(33);
    expect(oversFromBalls(33)).toBe(5.3);
    expect(ballsFromOvers(6)).toBe(36);
    expect(oversFromBalls(0)).toBe(0);
  });
});

const win = (
  a: string,
  b: string,
  winner: string,
  ar: number,
  ab: number,
  br: number,
  bb: number,
): ResultFixture => ({
  team_a_id: a,
  team_b_id: b,
  status: 'COMPLETED',
  result_type: 'WIN',
  winner_team_id: winner,
  team_a_runs: ar,
  team_a_balls: ab,
  team_b_runs: br,
  team_b_balls: bb,
});

describe('points table', () => {
  const teams = [
    { team_id: 'a', name: 'Alpha' },
    { team_id: 'b', name: 'Bravo' },
    { team_id: 'c', name: 'Charlie' },
  ];

  it('awards 2 for a win, 1 for a tie or no result, 0 for a loss', () => {
    const table = computePointsTable(teams, [
      win('a', 'b', 'a', 60, 36, 50, 36),
      {
        ...win('b', 'c', 'b', 0, 0, 0, 0),
        result_type: 'TIE',
        winner_team_id: null,
        team_a_runs: 40,
        team_a_balls: 36,
        team_b_runs: 40,
        team_b_balls: 36,
      },
      { ...win('a', 'c', 'a', 0, 0, 0, 0), result_type: 'NO_RESULT', winner_team_id: null },
    ]);
    const get = (id: string) => table.find((r) => r.team_id === id)!;
    expect(get('a')).toMatchObject({ played: 2, won: 1, points: 3, no_result: 1 });
    expect(get('b')).toMatchObject({ played: 2, lost: 1, tied: 1, points: 1 });
    expect(get('c')).toMatchObject({ played: 2, tied: 1, no_result: 1, points: 2 });
  });

  it('computes net run rate from runs and balls faced', () => {
    // A: 60 off 36 balls (10.0 rpo) v B: 50 off 36 (8.33 rpo)
    const [first, second] = computePointsTable(teams.slice(0, 2), [
      win('a', 'b', 'a', 60, 36, 50, 36),
    ]);
    expect(first.team_id).toBe('a');
    expect(first.nrr).toBeCloseTo(1.667, 2);
    expect(second.nrr).toBeCloseTo(-1.667, 2);
  });

  it('ranks on points, then wins, then net run rate, then name', () => {
    const fixtures = [
      win('a', 'b', 'a', 50, 36, 49, 36),
      win('b', 'c', 'b', 80, 36, 40, 36),
      win('c', 'a', 'c', 45, 36, 44, 36),
    ];
    // everyone has 1 win / 2 pts: NRR decides. B scored the biggest margin.
    const table = computePointsTable(teams, fixtures);
    expect(table[0].team_id).toBe('b');
    expect(table.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(table[0].nrr).toBeGreaterThan(table[1].nrr);
    expect(table[1].nrr).toBeGreaterThan(table[2].nrr);
  });

  it('breaks a complete tie alphabetically and ignores unplayed fixtures', () => {
    const table = computePointsTable(teams, [
      {
        ...win('a', 'b', 'a', 0, 0, 0, 0),
        status: 'SCHEDULED',
        result_type: null,
        winner_team_id: null,
      },
    ]);
    expect(table.map((r) => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });

  it('does not count run rate for a no-result', () => {
    const table = computePointsTable(teams.slice(0, 2), [
      { ...win('a', 'b', 'a', 30, 12, 0, 0), result_type: 'NO_RESULT', winner_team_id: null },
    ]);
    expect(table.every((r) => r.nrr === 0)).toBe(true);
  });
});

describe('knockoutQualifiers', () => {
  it.each([
    [3, 2],
    [4, 4],
    [6, 4],
    [10, 4],
  ])('%i teams -> top %i go through', (teams, expected) => {
    expect(knockoutQualifiers(teams)).toBe(expected);
  });
});
