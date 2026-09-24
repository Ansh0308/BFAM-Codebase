// Long tail — skill-aware team balancing (PRD §12.28). Pure so the
// balancing rules are unit-testable. Scoping decisions (no founder
// available — see RESUME_STATE.md):
// - Strength is players.skill_rating (the platform's one skill number);
//   experience_level is NOT added on top, because skill_rating already
//   moves with results and would double-count.
// - Greedy "strongest-first onto the weaker side": sort by strength desc,
//   put each player on the team with the lower running total, subject to
//   team sizes never differing by more than one. Not optimal (that's
//   NP-hard partitioning) but within one player's strength of optimal for
//   the ≤22-player rosters this sees, and deterministic.
// - Playing role is a tie-break only: when both sides are equally strong,
//   the player joins the side with fewer of their role, so keepers and
//   bowlers spread out. Strength still wins over role.
// - It is a *suggestion* — nothing is assigned; the organizer applies it.
export interface BalanceCandidate {
  player_id: string;
  skill_rating: number;
  playing_role: string | null;
}

export interface BalancedTeams {
  team_a: string[];
  team_b: string[];
  strength_a: number;
  strength_b: number;
}

export function balanceTeams(players: BalanceCandidate[]): BalancedTeams {
  const sorted = [...players].sort(
    (a, b) => b.skill_rating - a.skill_rating || a.player_id.localeCompare(b.player_id),
  );
  const maxSize = Math.ceil(sorted.length / 2);
  const teams = [
    { ids: [] as string[], strength: 0, roles: new Map<string, number>() },
    { ids: [] as string[], strength: 0, roles: new Map<string, number>() },
  ];

  for (const p of sorted) {
    const open = teams.filter((t) => t.ids.length < maxSize);
    let target = open[0];
    if (open.length === 2) {
      if (teams[0].strength !== teams[1].strength) {
        target = teams[0].strength < teams[1].strength ? teams[0] : teams[1];
      } else {
        const role = p.playing_role ?? '';
        const a = teams[0].roles.get(role) ?? 0;
        const b = teams[1].roles.get(role) ?? 0;
        target = b < a ? teams[1] : teams[0];
      }
    }
    target.ids.push(p.player_id);
    target.strength += p.skill_rating;
    const role = p.playing_role ?? '';
    target.roles.set(role, (target.roles.get(role) ?? 0) + 1);
  }

  return {
    team_a: teams[0].ids,
    team_b: teams[1].ids,
    strength_a: teams[0].strength,
    strength_b: teams[1].strength,
  };
}
