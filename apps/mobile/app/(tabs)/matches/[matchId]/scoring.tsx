import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { GameRoom, IntroMatchTeam, LiveScore, WicketType } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { ChipSelect } from '../../../../src/components/ChipSelect';
import { TextField } from '../../../../src/components/TextField';
import { ToggleRow } from '../../../../src/components/ToggleRow';
import { playTriggerSound } from '../../../../src/lib/sounds';

const RUN_BUTTONS = [0, 1, 2, 3, 4, 6];
const WICKET_TYPES: WicketType[] = [
  'BOWLED',
  'CAUGHT',
  'RUN_OUT',
  'STUMPED',
  'LBW',
  'HIT_WICKET',
  'RETIRED',
];
type ExtraKind = 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE';

// Backlog A-9: shows the player's real name where they've set one — not
// everyone playing together knows each other's BFAM ID — falling back to
// the BFAM ID for a player who hasn't set a name yet.
function displayName(p: { full_name?: string | null; bfam_id?: string }): string {
  return p.full_name || p.bfam_id || '';
}

// Scoring Interface (PRD §12.18 requirement 2). Organizer/scorer only —
// the backend re-enforces Scorer Selection (module §12.19: player- vs
// turf-staff-managed) regardless of what this screen shows.
export default function ScoringInterfaceScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [matchTeams, setMatchTeams] = useState<IntroMatchTeam[]>([]);
  const [live, setLive] = useState<LiveScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);

  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);

  const [pendingExtra, setPendingExtra] = useState<ExtraKind | null>(null);
  const [pendingWicket, setPendingWicket] = useState(false);
  const [wicketType, setWicketType] = useState<WicketType | null>(null);

  const [battingSide, setBattingSide] = useState<string | null>(null);
  const [bowlingSide, setBowlingSide] = useState<string | null>(null);
  const [targetRuns, setTargetRuns] = useState<string>('');
  // Backlog A-8: chosen once, before the very first innings — the backend
  // rejects changing it after any innings exists, so this only matters on
  // the pre-first-innings screen below.
  const [extrasCountTowardScore, setExtrasCountTowardScore] = useState(true);
  // Backlog A-10: local edits to each player's side before they're saved —
  // seeded from match_players.match_team_id on load, so re-entering this
  // screen (or a page that assigned sides earlier, e.g. the Playing XI
  // reveal) doesn't lose prior work.
  const [sideAssignments, setSideAssignments] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gameRoom, intro, liveScore, scorecard] = await Promise.all([
        apiClient.getGameRoom(matchId),
        apiClient.getMatchIntro(matchId).catch(() => null),
        apiClient.getLiveScore(matchId),
        apiClient.getScorecard(matchId).catch(() => null),
      ]);
      setRoom(gameRoom);
      setMatchTeams(intro?.matchTeams ?? []);
      setLive(liveScore);
      if (intro) setMusicEnabled(intro.intro.background_music_enabled);
      if (scorecard) setExtrasCountTowardScore(scorecard.extras_count_toward_score);
      setSideAssignments((prev) => {
        const next = { ...prev };
        for (const p of gameRoom.players) {
          if (p.match_team_id && !next[p.player_id]) next[p.player_id] = p.match_team_id;
        }
        return next;
      });
    } catch {
      setError('Could not load scoring data.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmedPlayers = room?.players.filter((p) => p.invitation_status === 'CONFIRMED') ?? [];
  const allSidesAssigned =
    confirmedPlayers.length > 0 && confirmedPlayers.every((p) => sideAssignments[p.player_id]);

  // Backlog A-10: once sides are assigned, the striker/non-striker pickers
  // only offer the batting side's players and the bowler picker only the
  // bowling side's — a player with no assignment yet (e.g. an older match
  // scored before this feature existed) falls back to appearing in both,
  // so nothing silently disappears for pre-existing matches.
  function optionsForSide(matchTeamId: string | null) {
    return confirmedPlayers
      .filter((p) => {
        const assigned = sideAssignments[p.player_id] ?? p.match_team_id;
        return !assigned || !matchTeamId || assigned === matchTeamId;
      })
      .map((p) => ({ value: p.player_id, label: displayName(p) }));
  }

  const battingOptions = live?.innings
    ? optionsForSide(live.innings.batting_match_team_id)
    : confirmedPlayers.map((p) => ({ value: p.player_id, label: displayName(p) }));
  const bowlingOptions = live?.innings
    ? optionsForSide(live.innings.bowling_match_team_id)
    : confirmedPlayers.map((p) => ({ value: p.player_id, label: displayName(p) }));

  async function startInnings() {
    if (!battingSide || !bowlingSide) return;
    setBusy(true);
    setError(null);
    try {
      // Only actually needed the first time (subsequent innings reuse the
      // same assignments), but idempotent — safe to send every time.
      const assignments = confirmedPlayers
        .filter((p) => sideAssignments[p.player_id])
        .map((p) => ({ player_id: p.player_id, match_team_id: sideAssignments[p.player_id] }));
      if (assignments.length > 0) {
        await apiClient.assignPlayerSides(matchId, assignments);
      }
      // Only meaningful before the very first innings — the backend
      // rejects this call once any innings exists, so only send it then.
      if (!live?.innings) {
        await apiClient.setExtrasCountTowardScore(matchId, extrasCountTowardScore);
      }
      await apiClient.startInnings(matchId, {
        innings_number: (live?.innings ? live.innings.innings_number : 0) + 1,
        batting_match_team_id: battingSide,
        bowling_match_team_id: bowlingSide,
        target_runs: targetRuns ? Number(targetRuns) : null,
      });
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not start the innings.');
    } finally {
      setBusy(false);
    }
  }

  // One-tap strike swap (feedback A-7: "minimal clicks everywhere") — lets
  // the organizer flip ends without re-picking both players from the chip
  // lists, e.g. after a run-out at the non-striker's end.
  function swapStrike() {
    setStrikerId(nonStrikerId);
    setNonStrikerId(strikerId);
  }

  async function submitBall(
    input: {
      runs_scored: number;
      extra_type: 'NONE' | ExtraKind;
      extra_runs: number;
      is_wicket: boolean;
      wicket_type?: WicketType | null;
    },
    options?: { rotateStrike?: boolean; clearStriker?: boolean },
  ) {
    if (!live?.innings || !strikerId || !bowlerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.recordBall(live.innings.innings_id, {
        striker_player_id: strikerId,
        non_striker_player_id: nonStrikerId,
        bowler_player_id: bowlerId,
        ...input,
      });
      if (res.audio_trigger !== 'NONE') {
        playTriggerSound(res.audio_trigger, musicEnabled).catch(() => {});
      }
      // Real-cricket strike rotation, done automatically instead of asking
      // the organizer to tap Swap after every odd-run ball — the single
      // biggest tap-count win in this screen since it fires on ~1 in 3
      // deliveries. A wicket instead clears the striker slot: the outgoing
      // batter can't just stay selected, and guessing the incoming one
      // would risk recording the next ball against the wrong player.
      if (options?.clearStriker) {
        setStrikerId(null);
      } else if (options?.rotateStrike) {
        swapStrike();
      }
      setPendingExtra(null);
      setPendingWicket(false);
      setWicketType(null);
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not record that ball.');
    } finally {
      setBusy(false);
    }
  }

  function pressRun(n: number) {
    if (pendingWicket) return; // wicket flow uses its own confirm
    // The batsmen physically cross on an odd number of runs run, whatever
    // the delivery type — n is exactly that count for every button here
    // (the extra runs above wide/no-ball's automatic 1, or the runs
    // themselves for a normal ball/bye/leg-bye).
    const rotateStrike = n % 2 === 1;
    if (pendingExtra) {
      const isWideOrNoBall = pendingExtra === 'WIDE' || pendingExtra === 'NO_BALL';
      submitBall(
        {
          runs_scored: isWideOrNoBall ? 0 : n,
          extra_type: pendingExtra,
          extra_runs: isWideOrNoBall ? 1 + n : n,
          is_wicket: false,
        },
        { rotateStrike },
      );
      return;
    }
    submitBall(
      { runs_scored: n, extra_type: 'NONE', extra_runs: 0, is_wicket: false },
      { rotateStrike },
    );
  }

  function confirmWicket() {
    if (!wicketType) return;
    submitBall(
      {
        runs_scored: 0,
        extra_type: 'NONE',
        extra_runs: 0,
        is_wicket: true,
        wicket_type: wicketType,
      },
      { clearStriker: true },
    );
  }

  async function undo() {
    if (!live?.innings) return;
    setBusy(true);
    try {
      await apiClient.undoBall(live.innings.innings_id);
      await load();
    } catch {
      setError('Nothing to undo.');
    } finally {
      setBusy(false);
    }
  }

  // Ends the current innings and immediately starts the next one with
  // sides swapped and a chase target set from the total just posted —
  // the standard two-innings limited-overs flow, in one tap instead of a
  // second form.
  async function endInningsAndStartNext() {
    if (!live?.innings) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.startInnings(matchId, {
        innings_number: live.innings.innings_number + 1,
        batting_match_team_id: live.innings.bowling_match_team_id,
        bowling_match_team_id: live.innings.batting_match_team_id,
        target_runs: live.innings.total_runs + 1,
      });
      setStrikerId(null);
      setNonStrikerId(null);
      setBowlerId(null);
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not start the next innings.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="scoring-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (!room) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="scoring-error">
          <Text className="font-ui text-body text-text-secondary text-center">
            Could not load this match.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!live?.innings) {
    return (
      <ScreenContainer scroll>
        <View className="pt-6" testID="start-innings-screen">
          <Text className="font-ui font-bold text-title-xl text-ink-black mb-4">Start Innings</Text>

          {/* Backlog A-10: every confirmed player must be assigned to a
              side before scoring can restrict pickers to the correct
              team — a one-time step for the whole match, done here since
              this screen only appears before the very first innings. */}
          <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
            Assign Players to a Side
          </Text>
          {confirmedPlayers.map((p) => (
            <View
              key={p.player_id}
              className="flex-row items-center justify-between py-2 border-b border-border-subtle"
              testID={`side-assignment-row-${p.player_id}`}
            >
              <Text className="font-ui text-body text-text-primary">{displayName(p)}</Text>
              <View className="flex-row">
                {matchTeams.map((t) => {
                  const selected = sideAssignments[p.player_id] === t.match_team_id;
                  return (
                    <Pressable
                      key={t.match_team_id}
                      onPress={() =>
                        setSideAssignments((prev) => ({ ...prev, [p.player_id]: t.match_team_id }))
                      }
                      className={`rounded-md border px-3 py-1.5 ml-2 ${
                        selected
                          ? 'bg-brand-red border-brand-red'
                          : 'bg-surface border-border-strong'
                      }`}
                      testID={`assign-${p.player_id}-${t.side_label}`}
                    >
                      <Text
                        className={`font-ui text-micro ${selected ? 'text-white font-bold' : 'text-text-primary'}`}
                      >
                        {t.side_label === 'TEAM_A' ? 'Team A' : 'Team B'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {!allSidesAssigned && (
            <Text className="font-ui text-micro text-text-tertiary mt-2 mb-2">
              Assign every player to a side before starting the innings.
            </Text>
          )}

          {/* Backlog A-8: a per-match rule, chosen once before the first
              ball is bowled — extras are always recorded exactly as
              bowled in score_events either way; this only controls
              whether they add to the official team total shown here on
              out. */}
          <ToggleRow
            label="Extras count toward the score"
            description="Wides, no-balls, byes and leg-byes still get recorded either way — this only controls whether they add to the team's official total."
            value={extrasCountTowardScore}
            onValueChange={setExtrasCountTowardScore}
            testID="extras-count-toggle"
          />

          <View className="mt-5">
            <ChipSelect
              label="Batting Side"
              options={matchTeams.map((t) => ({
                value: t.match_team_id,
                label: t.side_label === 'TEAM_A' ? 'Team A' : 'Team B',
              }))}
              value={battingSide}
              onChange={(v) => {
                setBattingSide(v);
                const other = matchTeams.find((t) => t.match_team_id !== v);
                setBowlingSide(other?.match_team_id ?? null);
              }}
              testID="batting-side"
            />
            <TextField
              label="Target Runs (2nd innings only)"
              value={targetRuns}
              onChangeText={setTargetRuns}
              placeholder="Leave blank for 1st innings"
              keyboardType="number-pad"
              testID="target-runs-input"
            />
            {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}
            <Button
              label="Start Innings"
              onPress={startInnings}
              loading={busy}
              disabled={!battingSide || !allSidesAssigned}
              testID="start-innings-button"
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface" testID="scoring-interface-screen">
      <View className="px-6 pt-6">
        <Text className="font-ui font-bold text-title-xl text-ink-black">
          {live.innings.total_runs}/{live.innings.total_wickets}
          <Text className="font-ui text-body text-text-secondary">
            {' '}
            ({live.innings.overs_completed} ov)
          </Text>
        </Text>
        {live.extras_count_toward_score === false && (
          <Text
            className="font-ui text-micro text-text-tertiary mt-1"
            testID="extras-excluded-note"
          >
            Extras don&apos;t count toward this score (still recorded for the record)
          </Text>
        )}

        <View className="mt-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary">
              Striker &amp; Non-Striker
            </Text>
            <Pressable
              onPress={swapStrike}
              disabled={!strikerId || !nonStrikerId}
              className="flex-row items-center"
              style={{ opacity: !strikerId || !nonStrikerId ? 0.4 : 1 }}
              testID="swap-strike-button"
            >
              <Text className="font-ui font-bold text-micro text-brand-red mr-1">⇄ SWAP</Text>
            </Pressable>
          </View>
          <ChipSelect
            label="Striker"
            options={battingOptions}
            value={strikerId}
            onChange={setStrikerId}
            testID="striker-select"
          />
          <ChipSelect
            label="Non-Striker"
            options={battingOptions}
            value={nonStrikerId}
            onChange={setNonStrikerId}
            testID="non-striker-select"
          />
          <ChipSelect
            label="Bowler"
            options={bowlingOptions}
            value={bowlerId}
            onChange={setBowlerId}
            testID="bowler-select"
          />
        </View>

        {error && <Text className="text-brand-red text-body mb-3">{error}</Text>}

        {pendingWicket ? (
          <View className="mt-2">
            <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
              Wicket Type
            </Text>
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
              {WICKET_TYPES.map((wt) => (
                <Pressable
                  key={wt}
                  onPress={() => setWicketType(wt)}
                  className={`rounded-md border px-3 py-2 m-1 ${wicketType === wt ? 'bg-brand-red border-brand-red' : 'bg-surface border-border-strong'}`}
                  testID={`wicket-type-${wt}`}
                >
                  <Text
                    className={`font-ui text-body ${wicketType === wt ? 'text-white font-bold' : 'text-text-primary'}`}
                  >
                    {wt.replace('_', ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row mt-3">
              <View className="flex-1 mr-2">
                <Button
                  label="Confirm Wicket"
                  onPress={confirmWicket}
                  disabled={!wicketType}
                  loading={busy}
                  testID="confirm-wicket"
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setPendingWicket(false);
                    setWicketType(null);
                  }}
                  testID="cancel-wicket"
                />
              </View>
            </View>
          </View>
        ) : (
          <>
            {pendingExtra && (
              <View className="bg-surface-alt rounded-md p-3 mt-2 mb-2">
                <Text className="font-ui text-micro text-text-secondary">
                  {pendingExtra.replace('_', ' ')} armed — tap a run value for additional runs, or 0
                  for none.
                </Text>
              </View>
            )}
            <View className="flex-row flex-wrap mt-2" style={{ marginHorizontal: -4 }}>
              {RUN_BUTTONS.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => pressRun(n)}
                  disabled={busy || !strikerId || !bowlerId}
                  className="items-center justify-center bg-brand-red rounded-md m-1"
                  style={{
                    width: 64,
                    height: 56,
                    opacity: busy || !strikerId || !bowlerId ? 0.5 : 1,
                  }}
                  testID={`run-${n}`}
                >
                  <Text className="font-ui font-bold text-title-xl text-white">{n}</Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row flex-wrap mt-2" style={{ marginHorizontal: -4 }}>
              {(['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE'] as ExtraKind[]).map((kind) => (
                <Pressable
                  key={kind}
                  onPress={() => setPendingExtra((cur) => (cur === kind ? null : kind))}
                  className={`rounded-md border px-3 py-3 m-1 ${pendingExtra === kind ? 'bg-brand-red border-brand-red' : 'bg-surface border-border-strong'}`}
                  testID={`extra-${kind}`}
                >
                  <Text
                    className={`font-ui text-body ${pendingExtra === kind ? 'text-white font-bold' : 'text-text-primary'}`}
                  >
                    {kind.replace('_', ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setPendingWicket(true)}
              disabled={busy || !strikerId || !bowlerId}
              className="rounded-md bg-ink-black items-center justify-center mt-3"
              style={{ height: 52, opacity: busy || !strikerId || !bowlerId ? 0.5 : 1 }}
              testID="wicket-button"
            >
              <Text className="font-ui font-bold text-button text-white uppercase tracking-wide">
                Wicket
              </Text>
            </Pressable>
          </>
        )}

        <View className="mt-6 mb-10">
          <View className="flex-row" style={{ marginHorizontal: -6 }}>
            <View className="flex-1 mx-1.5">
              <Button
                label="Undo Last Ball"
                variant="secondary"
                onPress={undo}
                loading={busy}
                testID="undo-button"
              />
            </View>
            {live.innings.innings_number === 1 && (
              <View className="flex-1 mx-1.5">
                <Button
                  label="End Innings & Start Next"
                  variant="secondary"
                  onPress={endInningsAndStartNext}
                  loading={busy}
                  testID="end-innings-button"
                />
              </View>
            )}
          </View>
          {live.innings.innings_number >= 2 && (
            <View className="mt-3">
              <Button
                label="Finish Match"
                onPress={() => router.push(`/(tabs)/matches/${matchId}/result`)}
                testID="finish-match-button"
              />
            </View>
          )}
          <View className="mt-3">
            <Button
              label="View Live Score"
              onPress={() => router.push(`/(tabs)/matches/${matchId}/live`)}
              testID="back-to-live"
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
