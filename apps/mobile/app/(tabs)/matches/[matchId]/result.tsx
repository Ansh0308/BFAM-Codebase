import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type {
  BattingRow,
  BowlingRow,
  GameRoom,
  IntroMatchTeam,
  MatchResult,
  Scorecard,
} from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { ChipSelect } from '../../../../src/components/ChipSelect';
import { useAuthStore } from '../../../../src/store/authStore';
import { useRebookStore } from '../../../../src/store/rebookStore';

const RESULT_TYPES: { value: 'WIN' | 'TIE' | 'NO_RESULT'; label: string }[] = [
  { value: 'WIN', label: 'Win' },
  { value: 'TIE', label: 'Tie' },
  { value: 'NO_RESULT', label: 'No Result' },
];

// A-22: highest score / best bowling figures for a completed innings —
// every number here is already computed server-side by getScorecard, this
// just picks the standout row per innings for the Result screen's summary.
function topBatter(rows: BattingRow[]): BattingRow | null {
  return rows.reduce<BattingRow | null>(
    (best, row) => (!best || row.runs > best.runs ? row : best),
    null,
  );
}

function topBowler(rows: BowlingRow[]): BowlingRow | null {
  return rows.reduce<BowlingRow | null>((best, row) => {
    if (!best) return row;
    if (row.wickets !== best.wickets) return row.wickets > best.wickets ? row : best;
    return row.economy < best.economy ? row : best;
  }, null);
}

// A-24: "automatically select Player of the Match based on overall
// performance" — a simple points formula (per the founder's choice), run
// purely over the scorecard data this screen already fetches: 1 point per
// run, 20 per wicket (roughly makes a useful bowling spell comparable to
// a useful batting innings, a common convention). Deliberately excludes
// fielding (catches/run-outs/stumpings) — the backend accepts a
// fielder_player_id on a wicket, but the scoring screen never actually
// collects one, so there's no fielder identity anywhere to credit yet.
// Summed across every innings so an all-rounder's bat-then-bowl (or
// bowl-then-bat) contributions both count.
const POTM_POINTS_PER_RUN = 1;
const POTM_POINTS_PER_WICKET = 20;

function suggestPlayerOfTheMatch(
  scorecard: Scorecard,
  eligiblePlayerIds: Set<string>,
): string | null {
  const points = new Map<string, number>();
  for (const inn of scorecard.innings) {
    for (const b of inn.batting) {
      if (!eligiblePlayerIds.has(b.player_id)) continue;
      points.set(b.player_id, (points.get(b.player_id) ?? 0) + b.runs * POTM_POINTS_PER_RUN);
    }
    for (const b of inn.bowling) {
      if (!eligiblePlayerIds.has(b.player_id)) continue;
      points.set(b.player_id, (points.get(b.player_id) ?? 0) + b.wickets * POTM_POINTS_PER_WICKET);
    }
  }
  let winner: string | null = null;
  let bestScore = -Infinity;
  for (const [playerId, score] of points) {
    if (score > bestScore) {
      bestScore = score;
      winner = playerId;
    }
  }
  return winner;
}

// Match Result (PRD §12.18 requirement 5): winner, margin, Player of the
// Match, plus a Match Summary (backlog A-22: run rate, top score, best
// bowling per innings) and a link to the full Scorecard.
export default function MatchResultScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [matchTeams, setMatchTeams] = useState<IntroMatchTeam[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [resultType, setResultType] = useState<'WIN' | 'TIE' | 'NO_RESULT'>('WIN');
  const [winningSide, setWinningSide] = useState<string | null>(null);
  const [margin, setMargin] = useState('');
  const [potmId, setPotmId] = useState<string | null>(null);

  const [rebooking, setRebooking] = useState(false);
  const [rebookError, setRebookError] = useState<string | null>(null);
  const setRebookPlan = useRebookStore((s) => s.setPlan);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gameRoom, intro, scorecardData] = await Promise.all([
        apiClient.getGameRoom(matchId),
        apiClient.getMatchIntro(matchId).catch(() => null),
        apiClient.getScorecard(matchId).catch(() => null),
      ]);
      setRoom(gameRoom);
      setMatchTeams(intro?.matchTeams ?? []);
      setScorecard(scorecardData);
      const existingResult = await apiClient.getMatchResult(matchId).catch(() => null);
      setResult(existingResult);
    } catch {
      setError('Could not load match result data.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  // A-24: pre-fill (never override a choice the organizer already made,
  // matching the same "computed-then-confirmed, not silently automatic"
  // pattern used for the toss auto-fill above) once there's a scorecard to
  // compute from — still a normal chip-select underneath, so the organizer
  // sees it and can tap someone else.
  useEffect(() => {
    if (potmId !== null || !room || !scorecard) return;
    const eligibleIds = new Set(
      room.players.filter((p) => p.invitation_status === 'CONFIRMED').map((p) => p.player_id),
    );
    const suggested = suggestPlayerOfTheMatch(scorecard, eligibleIds);
    if (suggested) setPotmId(suggested);
  }, [room, scorecard, potmId]);

  async function finalize() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.finalizeMatch(matchId, {
        result_type: resultType,
        winning_match_team_id: resultType === 'WIN' ? winningSide : null,
        winning_margin: margin || null,
        player_of_the_match_id: potmId,
      });
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not finalize the match.');
    } finally {
      setBusy(false);
    }
  }

  // Rebook Same Players (module 2.10, PRD §12.44): fetches the same turf/
  // format/roster and hands it to the availability screen (module 2.3) via
  // rebookStore — Create Game (module 2.6) reads it back once the new
  // booking is confirmed.
  async function rebook() {
    setRebooking(true);
    setRebookError(null);
    try {
      const info = await apiClient.getRebookInfo(matchId);
      setRebookPlan(info);
      router.push(
        `/(tabs)/discover/turf/${info.turf_id}/availability?turfName=${encodeURIComponent(info.turf_name)}`,
      );
    } catch (err) {
      setRebookError(err instanceof BFAMApiError ? err.message : 'Could not start a rebook.');
    } finally {
      setRebooking(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="result-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (!room) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="result-error">
          <Text className="font-ui text-body text-text-secondary text-center">
            Could not load this match.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const isManager =
    room.organizer_id === user?.user_id || room.assigned_scorer_id === user?.user_id;
  const confirmedPlayers = room.players.filter((p) => p.invitation_status === 'CONFIRMED');

  if (result) {
    const winningSideLabel = matchTeams.find(
      (t) => t.match_team_id === result.winning_match_team_id,
    )?.side_label;
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-6" testID="result-display">
          <Feather name="award" size={56} color="#D80000" />
          <Text className="font-ui font-bold text-title-xl text-ink-black text-center mt-4">
            {result.result_type === 'WIN'
              ? `${winningSideLabel === 'TEAM_A' ? 'Team A' : 'Team B'} Won`
              : result.result_type === 'TIE'
                ? 'Match Tied'
                : 'No Result'}
          </Text>
          {result.winning_margin && (
            <Text className="font-ui text-body text-text-secondary text-center mt-2">
              {result.winning_margin}
            </Text>
          )}
          {result.player_of_the_match_bfam_id && (
            <View className="rounded-full border border-brand-red px-4 py-2 mt-6">
              <Text className="font-ui font-bold text-body text-brand-red">
                Player of the Match: {result.player_of_the_match_bfam_id}
              </Text>
            </View>
          )}
          {rebookError && (
            <Text
              className="text-brand-red text-body mt-4 text-center"
              testID="rebook-error-message"
            >
              {rebookError}
            </Text>
          )}
          {/* A-22: run rate, top score, and best bowling per innings —
              right where a viewer lands at the end of the match, instead
              of only inside the full Scorecard (which nothing on this
              screen used to link to at all). */}
          {scorecard && scorecard.innings.length > 0 && (
            <View className="mt-8 w-full" testID="match-summary">
              <Text className="font-ui font-bold text-section-header text-ink-black mb-3">
                Match Summary
              </Text>
              {scorecard.innings.map((inn) => {
                const topBat = topBatter(inn.batting);
                const topBowl = topBowler(inn.bowling);
                return (
                  <View
                    key={inn.innings_id}
                    className="bg-surface-alt rounded-lg p-4 mb-3"
                    testID={`match-summary-innings-${inn.innings_number}`}
                  >
                    <Text className="font-ui font-bold text-body text-ink-black">
                      Innings {inn.innings_number}: {inn.total_runs}/{inn.total_wickets} (
                      {inn.overs_completed} ov)
                    </Text>
                    <Text className="font-ui text-micro text-text-secondary mt-1">
                      Run Rate: {inn.run_rate}
                    </Text>
                    {topBat && (
                      <Text className="font-ui text-body text-text-primary mt-2">
                        Top Score: {topBat.bfam_id} — {topBat.runs} ({topBat.balls}b, {topBat.fours}
                        x4, {topBat.sixes}x6)
                      </Text>
                    )}
                    {topBowl && (
                      <Text className="font-ui text-body text-text-primary mt-1">
                        Best Bowling: {topBowl.bfam_id} — {topBowl.wickets}/{topBowl.runs_conceded}{' '}
                        ({topBowl.overs} ov, Econ {topBowl.economy})
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View className="mt-3 w-full">
            <Button
              label="Full Scorecard"
              variant="secondary"
              iconLeft={<Feather name="list" size={16} color="#D80000" />}
              onPress={() => router.push(`/(tabs)/matches/${matchId}/scorecard`)}
              testID="open-scorecard"
            />
          </View>
          {/* Backlog B-4: prompts the player to review the match/turf right
              where they land after it's finalized — the natural moment,
              per the feedback's own framing ("after a match, ask the
              player to review"). */}
          <View className="mt-3 w-full">
            <Button
              label="Rate This Match"
              variant="secondary"
              iconLeft={<Feather name="star" size={16} color="#0D0D0D" />}
              onPress={() => router.push(`/match-review?matchId=${matchId}`)}
              testID="open-review"
            />
          </View>
          {room.organizer_id === user?.user_id && (
            <View className="mt-3 w-full">
              <Button
                label="Rebook Same Players"
                iconLeft={<Feather name="repeat" size={16} color="#FFFFFF" />}
                onPress={rebook}
                loading={rebooking}
                testID="rebook-same-players"
              />
            </View>
          )}
        </View>
      </ScreenContainer>
    );
  }

  if (!isManager) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="result-not-finalized">
          <Text className="font-ui text-body text-text-secondary text-center">
            The result hasn&apos;t been finalized yet.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View className="pt-6" testID="finalize-result-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black mb-4">Finalize Result</Text>

        <ChipSelect
          label="Result"
          options={RESULT_TYPES}
          value={resultType}
          onChange={(v) => setResultType(v as typeof resultType)}
          testID="result-type"
        />

        {resultType === 'WIN' && (
          <ChipSelect
            label="Winning Side"
            options={matchTeams.map((t) => ({
              value: t.match_team_id,
              label: t.side_label === 'TEAM_A' ? 'Team A' : 'Team B',
            }))}
            value={winningSide}
            onChange={setWinningSide}
            testID="winning-side"
          />
        )}

        <TextField
          label="Margin (optional)"
          value={margin}
          onChangeText={setMargin}
          placeholder="e.g. 24 runs"
          testID="margin-input"
        />

        <ChipSelect
          label="Player of the Match"
          options={confirmedPlayers.map((p) => ({
            value: p.player_id,
            label: p.full_name || p.bfam_id || '',
          }))}
          value={potmId}
          onChange={setPotmId}
          testID="potm-select"
        />
        {scorecard && scorecard.innings.length > 0 && (
          <Text
            className="font-ui text-micro text-text-tertiary -mt-3 mb-4"
            testID="potm-suggested-note"
          >
            Suggested from this match&apos;s runs and wickets — tap another player to override.
          </Text>
        )}

        {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

        <Button label="Finalize Match" onPress={finalize} loading={busy} testID="finalize-button" />
      </View>
    </ScreenContainer>
  );
}
