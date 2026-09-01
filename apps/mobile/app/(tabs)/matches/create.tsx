import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { Booking, MatchBallType, MatchScoringMode, MatchType } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../src/lib/apiClient';
import { colors } from '../../../src/theme/tokens';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { Button } from '../../../src/components/Button';
import { TextField } from '../../../src/components/TextField';
import { ChipSelect } from '../../../src/components/ChipSelect';

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
export default function CreateMatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string }>();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(!params.bookingId);
  const [bookingId, setBookingId] = useState<string | null>(params.bookingId ?? null);

  const [matchName, setMatchName] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('FRIENDS');
  const [ballType, setBallType] = useState<MatchBallType>('TENNIS');
  const [oversPerInnings, setOversPerInnings] = useState('8');
  const [scoringMode, setScoringMode] = useState<MatchScoringMode>('PLAYER_MANAGED');
  const [assignedScorerId, setAssignedScorerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      });
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
        {!params.bookingId && (
          <>
            <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
              Booking
            </Text>
            {loadingBookings ? (
              <ActivityIndicator color={colors.brandRed} testID="create-match-bookings-loading" />
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
