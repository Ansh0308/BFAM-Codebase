import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BallLoader } from '../../../src/components/BallLoader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type {
  Booking,
  MatchBallType,
  MatchScoringMode,
  MatchType,
  MyTeam,
  OpenTeam,
} from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../src/lib/apiClient';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { Button } from '../../../src/components/Button';
import { TextField } from '../../../src/components/TextField';
import { ChipSelect } from '../../../src/components/ChipSelect';
import { ToggleRow } from '../../../src/components/ToggleRow';
import { useRebookStore } from '../../../src/store/rebookStore';
import { useChallengeMatchStore } from '../../../src/store/challengeMatchStore';

const MATCH_TYPES: { value: MatchType; label: string }[] = [
  { value: 'FRIENDS', label: 'Friends' },
  { value: 'FAIR_PLAY', label: 'Fair Play' },
  { value: 'TOURNAMENT', label: 'Tournament' },
];
const BALL_TYPES: { value: MatchBallType; label: string }[] = [
  { value: 'TENNIS', label: 'Tennis' },
  { value: 'HARD_TENNIS', label: 'Hard Tennis' },
];
const SCORING_MODES: { value: MatchScoringMode; label: string }[] = [
  { value: 'PLAYER_MANAGED', label: 'Player Managed' },
  { value: 'TURF_STAFF_MANAGED', label: 'Turf Staff Managed' },
];
const OVERS_OPTIONS = ['5', '6', '8', '10', '15', '20'];

// Create Game (PRD §12.9): link to a confirmed booking, choose format,
// ball type, scoring mode, and (if turf-staff-managed) assign a scorer.
// When reached via Rebook Same Players (module 2.10, PRD §12.44), the
// format fields below are prefilled from rebookStore and the prior
// roster is re-invited automatically on success.
export default function CreateMatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string }>();

  const rebookPlan = useRebookStore((s) => s.plan);
  const clearRebookPlan = useRebookStore((s) => s.clear);

  // Backlog B-13: reached via "Create Match" on an ACCEPTED challenge —
  // prefills both real teams instead of the usual pick-your-team-then-
  // search-an-opponent flow.
  const challengeMatchPlan = useChallengeMatchStore((s) => s.plan);
  const clearChallengeMatchPlan = useChallengeMatchStore((s) => s.clear);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(!params.bookingId);
  const [bookingId, setBookingId] = useState<string | null>(params.bookingId ?? null);

  const [matchName, setMatchName] = useState(rebookPlan?.match_name ?? '');
  const [matchType, setMatchType] = useState<MatchType>(
    (rebookPlan?.match_type as MatchType) ?? 'FRIENDS',
  );
  const [ballType, setBallType] = useState<MatchBallType>(
    (rebookPlan?.ball_type as MatchBallType) ?? 'TENNIS',
  );
  const [oversPerInnings, setOversPerInnings] = useState(
    rebookPlan ? String(rebookPlan.overs_per_innings) : '8',
  );
  const [scoringMode, setScoringMode] = useState<MatchScoringMode>(
    (rebookPlan?.scoring_mode as MatchScoringMode) ?? 'PLAYER_MANAGED',
  );
  const [assignedScorerId, setAssignedScorerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Backlog G-20: an optional team-vs-team match — skipped entirely for a
  // casual Friends match, which keeps working exactly as it does today.
  const [isTeamMatch, setIsTeamMatch] = useState(!!challengeMatchPlan);
  const [myTeams, setMyTeams] = useState<MyTeam[]>([]);
  const [loadingMyTeams, setLoadingMyTeams] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState<string | null>(
    challengeMatchPlan?.home_team_id ?? null,
  );
  const [opponentQuery, setOpponentQuery] = useState('');
  const [opponentResults, setOpponentResults] = useState<OpenTeam[]>([]);
  const [searchingOpponents, setSearchingOpponents] = useState(false);
  const [awayTeamId, setAwayTeamId] = useState<string | null>(
    challengeMatchPlan?.away_team_id ?? null,
  );
  const [awayTeamName, setAwayTeamName] = useState<string | null>(
    challengeMatchPlan?.away_team_name ?? null,
  );

  useEffect(() => {
    if (!isTeamMatch || myTeams.length > 0 || loadingMyTeams) return;
    setLoadingMyTeams(true);
    apiClient
      .getMyTeams()
      .then((res) => {
        setMyTeams(res.results);
        if (res.results.length === 1) setHomeTeamId((prev) => prev ?? res.results[0].team_id);
      })
      .catch(() => setMyTeams([]))
      .finally(() => setLoadingMyTeams(false));
  }, [isTeamMatch, myTeams.length, loadingMyTeams]);

  const searchOpponents = useCallback(
    (query: string) => {
      setOpponentQuery(query);
      setAwayTeamId(null);
      setAwayTeamName(null);
      if (!query.trim()) {
        setOpponentResults([]);
        return;
      }
      setSearchingOpponents(true);
      apiClient
        .searchTeams(query.trim())
        .then((res) => setOpponentResults(res.results.filter((t) => t.team_id !== homeTeamId)))
        .catch(() => setOpponentResults([]))
        .finally(() => setSearchingOpponents(false));
    },
    [homeTeamId],
  );

  useEffect(() => {
    if (params.bookingId) return;
    apiClient
      .getMyBookings('upcoming')
      .then((res) => setBookings(res.results.filter((b) => b.booking_status === 'CONFIRMED')))
      .catch(() => setBookings([]))
      .finally(() => setLoadingBookings(false));
  }, [params.bookingId]);

  async function submit() {
    if (!bookingId) {
      setError('Choose a confirmed booking to create a match for.');
      return;
    }
    if (scoringMode === 'TURF_STAFF_MANAGED' && !assignedScorerId.trim()) {
      setError('Turf-staff-managed scoring needs an assigned scorer.');
      return;
    }
    if (isTeamMatch && (!homeTeamId || !awayTeamId)) {
      setError('Pick both Your Team and the Opponent Team, or turn off Team Match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const match = await apiClient.createMatch({
        booking_id: bookingId,
        match_name: matchName || null,
        match_type: matchType,
        ball_type: ballType,
        overs_per_innings: Number(oversPerInnings),
        scoring_mode: scoringMode,
        assigned_scorer_id: scoringMode === 'TURF_STAFF_MANAGED' ? assignedScorerId.trim() : null,
        home_team_id: isTeamMatch ? homeTeamId : null,
        away_team_id: isTeamMatch ? awayTeamId : null,
      });

      // Rebook Same Players (PRD §12.44): re-invite the prior match's
      // roster. The organizer is already on the new roster via
      // createMatch, so their own re-invite (if present in the roster) is
      // expected to fail with "already on the roster" — every player is
      // invited independently so one such failure never blocks the rest.
      if (rebookPlan) {
        await Promise.all(
          rebookPlan.roster.map((p) =>
            apiClient.inviteToMatch(match.match_id, p.player_id).catch(() => {}),
          ),
        );
        clearRebookPlan();
      }
      if (challengeMatchPlan) clearChallengeMatchPlan();

      router.replace(`/(tabs)/matches/${match.match_id}`);
    } catch (err) {
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Could not create the match. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <View className="pt-4" testID="create-match-screen">
        {rebookPlan && (
          <View
            className="flex-row items-center bg-surface-alt rounded-md p-3 mb-4"
            testID="rebook-banner"
          >
            <Feather name="repeat" size={16} color="#D80000" />
            <Text className="font-ui text-body text-text-primary ml-2">
              Rebooking with {rebookPlan.roster.length} player
              {rebookPlan.roster.length === 1 ? '' : 's'} from your last match at{' '}
              {rebookPlan.turf_name}.
            </Text>
          </View>
        )}
        {challengeMatchPlan && (
          <View
            className="flex-row items-center bg-surface-alt rounded-md p-3 mb-4"
            testID="challenge-match-banner"
          >
            <Feather name="shield" size={16} color="#D80000" />
            <Text className="font-ui text-body text-text-primary ml-2">
              {challengeMatchPlan.home_team_name} vs {challengeMatchPlan.away_team_name} — accepted
              challenge, both rosters will be invited.
            </Text>
          </View>
        )}
        {!params.bookingId && (
          <>
            <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
              Booking
            </Text>
            {loadingBookings ? (
              <BallLoader size="inline" testID="create-match-bookings-loading" />
            ) : bookings.length === 0 ? (
              <Text className="font-ui text-body text-text-secondary mb-4">
                No confirmed bookings without a match yet. Book a turf first.
              </Text>
            ) : (
              <View className="mb-4">
                {bookings.map((b) => {
                  const selected = bookingId === b.booking_id;
                  return (
                    <Pressable
                      key={b.booking_id}
                      onPress={() => setBookingId(b.booking_id)}
                      className={[
                        'flex-row items-center rounded-md border p-3 mb-2',
                        selected
                          ? 'border-brand-red bg-surface'
                          : 'border-border-strong bg-surface',
                      ].join(' ')}
                      testID={`create-match-booking-${b.booking_id}`}
                    >
                      <Feather
                        name={selected ? 'check-circle' : 'circle'}
                        size={18}
                        color={selected ? '#D80000' : '#9A9A9A'}
                      />
                      <View className="ml-3 flex-1">
                        <Text className="font-ui font-semibold text-body text-text-primary">
                          {b.turf_name ?? 'Turf'}
                        </Text>
                        <Text className="font-ui text-micro text-text-tertiary mt-0.5">
                          {b.booking_date} · {b.start_time}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

        <TextField
          label="Match Name (optional)"
          value={matchName}
          onChangeText={setMatchName}
          placeholder="e.g. Sunday Evening Bash"
        />

        <View className="bg-surface-alt rounded-md px-4 mb-4">
          <ToggleRow
            label="Team Match"
            description="Pick two real teams — everyone on both rosters is invited at once, and sides are assigned automatically as they confirm."
            value={isTeamMatch}
            onValueChange={setIsTeamMatch}
            testID="team-match-toggle"
          />
        </View>

        {isTeamMatch && (
          <View className="mb-4">
            <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
              Your Team
            </Text>
            {loadingMyTeams ? (
              <BallLoader size="inline" testID="my-teams-loading" />
            ) : myTeams.length === 0 ? (
              <Text className="font-ui text-body text-text-secondary mb-2">
                You&apos;re not an active member of any team yet.
              </Text>
            ) : (
              myTeams.map((team) => {
                const selected = homeTeamId === team.team_id;
                return (
                  <Pressable
                    key={team.team_id}
                    onPress={() => setHomeTeamId(team.team_id)}
                    className={[
                      'flex-row items-center rounded-md border p-3 mb-2',
                      selected ? 'border-brand-red bg-surface' : 'border-border-strong bg-surface',
                    ].join(' ')}
                    testID={`home-team-option-${team.team_id}`}
                  >
                    <Feather
                      name={selected ? 'check-circle' : 'circle'}
                      size={18}
                      color={selected ? '#D80000' : '#9A9A9A'}
                    />
                    <Text className="font-ui font-semibold text-body text-text-primary ml-3">
                      {team.team_name}
                    </Text>
                  </Pressable>
                );
              })
            )}

            <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2 mt-3">
              Opponent Team
            </Text>
            <TextField
              label=""
              value={opponentQuery}
              onChangeText={searchOpponents}
              placeholder="Search teams by name"
              iconLeft={<Feather name="search" size={16} color="#767676" />}
              testID="opponent-team-search-input"
            />
            {awayTeamName ? (
              <View
                className="flex-row items-center justify-between rounded-md border border-brand-red bg-surface p-3 mt-2"
                testID="opponent-team-selected"
              >
                <View className="flex-row items-center">
                  <Feather name="check-circle" size={18} color="#D80000" />
                  <Text className="font-ui font-semibold text-body text-text-primary ml-3">
                    {awayTeamName}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setAwayTeamId(null);
                    setAwayTeamName(null);
                  }}
                  hitSlop={8}
                  testID="opponent-team-clear"
                >
                  <Feather name="x" size={16} color="#767676" />
                </Pressable>
              </View>
            ) : searchingOpponents ? (
              <BallLoader size="inline" testID="opponent-teams-loading" style={{ marginTop: 8 }} />
            ) : (
              opponentResults.map((team) => (
                <Pressable
                  key={team.team_id}
                  onPress={() => {
                    setAwayTeamId(team.team_id);
                    setAwayTeamName(team.team_name);
                  }}
                  className="flex-row items-center rounded-md border border-border-strong bg-surface p-3 mt-2"
                  testID={`opponent-team-option-${team.team_id}`}
                >
                  <Feather name="shield" size={16} color="#9A9A9A" />
                  <Text className="font-ui text-body text-text-primary ml-3">{team.team_name}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <ChipSelect
          label="Format"
          options={MATCH_TYPES}
          value={matchType}
          onChange={(v) => setMatchType(v as MatchType)}
          testID="match-type"
        />
        <ChipSelect
          label="Ball Type"
          options={BALL_TYPES}
          value={ballType}
          onChange={(v) => setBallType(v as MatchBallType)}
          testID="ball-type"
        />
        <ChipSelect
          label="Overs per Innings"
          options={OVERS_OPTIONS.map((o) => ({ value: o, label: o }))}
          value={oversPerInnings}
          onChange={setOversPerInnings}
          testID="overs"
        />
        <ChipSelect
          label="Scoring Mode"
          options={SCORING_MODES}
          value={scoringMode}
          onChange={(v) => setScoringMode(v as MatchScoringMode)}
          testID="scoring-mode"
        />

        {scoringMode === 'TURF_STAFF_MANAGED' && (
          <TextField
            label="Assigned Scorer (User ID)"
            value={assignedScorerId}
            onChangeText={setAssignedScorerId}
            placeholder="Turf staff user ID"
            testID="assigned-scorer-input"
          />
        )}

        {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

        <View className="mb-10">
          <Button
            label="Create Match"
            onPress={submit}
            loading={submitting}
            testID="submit-create-match"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
