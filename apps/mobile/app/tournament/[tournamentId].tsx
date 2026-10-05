import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  MyTeam,
  TournamentDetail,
  TournamentEntry,
  TournamentFixture,
} from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../src/lib/apiClient';
import { confirmAction } from '../../src/lib/confirm';
import {
  Chip,
  HeroCard,
  HubCard,
  HubLoading,
  HubMessage,
  HubScreen,
  IconBadge,
  PillButton,
  PillTabs,
  SectionLabel,
} from '../../src/components/hub/HubParts';
import { FORMAT_LABEL, STATUS_LABEL } from '../../src/lib/tournamentLabels';

type Tab = 'teams' | 'fixtures' | 'table' | 'bracket';

const ENTRY_LABEL: Record<TournamentEntry['status'], string> = {
  PENDING: 'WAITING FOR APPROVAL',
  APPROVED: 'ACCEPTED',
  REJECTED: 'NOT ACCEPTED',
  WITHDRAWN: 'WITHDRAWN',
};

const day = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

function scoreText(f: TournamentFixture, side: 'a' | 'b'): string {
  const runs = side === 'a' ? f.team_a_runs : f.team_b_runs;
  const wkts = side === 'a' ? f.team_a_wickets : f.team_b_wickets;
  const overs = side === 'a' ? f.team_a_overs : f.team_b_overs;
  if (runs == null) return '';
  return `${runs}${wkts != null ? `/${wkts}` : ''}${overs != null ? ` (${overs})` : ''}`;
}

function resultLine(f: TournamentFixture): string {
  if (f.status !== 'COMPLETED') return '';
  if (f.result_type === 'NO_RESULT')
    return f.winner_name ? `${f.winner_name} advance` : 'No result';
  if (f.result_type === 'TIE') return f.winner_name ? `Tied · ${f.winner_name} advance` : 'Tied';
  return `${f.winner_name ?? ''} won`;
}

// One tournament, for players and captains: entry, fee, fixtures, the points
// table and the bracket. A captain enters their team here, pays the entry fee
// the same way as a turf booking (UPI / gateway through Razorpay), and can
// watch a fixture live once the host starts it.
export default function TournamentScreen() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [captainOf, setCaptainOf] = useState<MyTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('teams');
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, mine] = await Promise.all([
        apiClient.getTournament(tournamentId),
        apiClient.getMyTeams().catch(() => ({ results: [] as MyTeam[] })),
      ]);
      setDetail(d);
      setCaptainOf(mine.results.filter((t) => t.role_in_team === 'CAPTAIN'));
      setError(null);
    } catch (err) {
      setDetail(null);
      setError(err instanceof BFAMApiError ? err.message : 'Could not load this tournament.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  const status = detail?.tournament.status;
  useEffect(() => {
    if (status === 'IN_PROGRESS') setTab('fixtures');
    else if (status === 'COMPLETED') setTab('table');
  }, [status]);

  const myEntries = useMemo(() => {
    const ids = new Set(captainOf.map((t) => t.team_id));
    return (detail?.entries ?? []).filter(
      (e) => ids.has(e.team_id) && e.status !== 'WITHDRAWN' && e.status !== 'REJECTED',
    );
  }, [detail, captainOf]);

  const enteredTeamIds = new Set(
    (detail?.entries ?? [])
      .filter((e) => e.status !== 'WITHDRAWN' && e.status !== 'REJECTED')
      .map((e) => e.team_id),
  );
  const freeTeams = captainOf.filter((t) => !enteredTeamIds.has(t.team_id));

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function enter(team: MyTeam) {
    setPicking(false);
    await run(
      () => apiClient.registerTournamentTeam(tournamentId, team.team_id),
      `${team.team_name} has been entered — the host will approve it.`,
    );
  }

  async function withdraw(entry: TournamentEntry) {
    const ok = await confirmAction(
      'Withdraw team?',
      `Take ${entry.team_name} out of this tournament?`,
      'Withdraw',
    );
    if (!ok) return;
    await run(
      () => apiClient.removeTournamentEntry(entry.entry_id),
      'Your team has been withdrawn.',
    );
  }

  // Same Razorpay flow as paying for a turf booking.
  async function payOnline(entry: TournamentEntry, method: 'UPI' | 'RAZORPAY') {
    if (Platform.OS === 'web') {
      setError(
        'UPI and card payments work in the BFAM Android app. On the website, pay the host in cash.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const order = await apiClient.payTournamentEntry(entry.entry_id, method);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RazorpayCheckout = require('react-native-razorpay').default;
      await RazorpayCheckout.open({
        key: order.key_id,
        order_id: order.order_id,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: 'BFAM',
        description: `${detail?.tournament.name ?? 'Tournament'} entry fee`,
        theme: { color: '#D80000' },
      });
      // The webhook confirms the payment a moment later.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const fresh = await apiClient.getTournament(tournamentId);
        setDetail(fresh);
        if (fresh.entries.find((e) => e.entry_id === entry.entry_id)?.payment_status === 'PAID') {
          setMessage('Entry fee paid. See you on the pitch!');
          return;
        }
      }
      setMessage("We're confirming your payment — it will show here shortly.");
    } catch (err) {
      const description = (err as { description?: string })?.description;
      setError(
        description ?? (err instanceof BFAMApiError ? err.message : 'Payment was not completed.'),
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <HubScreen title="Tournament" backTestID="tournament-back" testID="tournament-screen">
        <HubLoading testID="tournament-loading" />
      </HubScreen>
    );
  }

  if (!detail) {
    return (
      <HubScreen title="Tournament" backTestID="tournament-back" testID="tournament-screen">
        <HubMessage tone="error" testID="tournament-error">
          {error ?? 'Tournament not found.'}
        </HubMessage>
      </HubScreen>
    );
  }

  const t = detail.tournament;
  const fee = Number(t.entry_fee);
  const approved = detail.entries.filter((e) => e.status === 'APPROVED');
  const entriesOpen = t.status === 'REGISTRATION_OPEN';
  const hasKnockout = detail.fixtures.some((f) => f.stage === 'KNOCKOUT');
  const hasLeague = detail.fixtures.some((f) => f.stage === 'LEAGUE');
  const tabs: { value: Tab; label: string }[] = [
    { value: 'teams', label: `Teams (${approved.length})` },
    { value: 'fixtures', label: 'Fixtures' },
    ...(t.format !== 'KNOCKOUT' ? [{ value: 'table' as Tab, label: 'Table' }] : []),
    ...(hasKnockout ? [{ value: 'bracket' as Tab, label: 'Bracket' }] : []),
  ];

  const fixtureCard = (f: TournamentFixture) => {
    const done = f.status === 'COMPLETED';
    const live = !!f.match_id && f.match_status !== 'COMPLETED' && f.match_status !== 'CANCELLED';
    return (
      <HubCard key={f.fixture_id} testID={`fixture-${f.match_number}`}>
        <View className="flex-row items-center justify-between" style={{ marginBottom: 8 }}>
          <Text className="font-ui text-text-tertiary" style={{ fontSize: 11, letterSpacing: 0.5 }}>
            MATCH {f.match_number} · {f.stage_label.toUpperCase()}
          </Text>
          {done ? (
            <Chip text="DONE" tone="muted" />
          ) : live ? (
            <Chip text={f.match_status === 'IN_PROGRESS' ? 'LIVE' : 'SET'} tone="solid" />
          ) : null}
        </View>
        {(
          [
            ['a', f.team_a_name],
            ['b', f.team_b_name],
          ] as const
        ).map(([side, name]) => (
          <View
            key={side}
            className="flex-row items-center justify-between"
            style={{ paddingVertical: 3 }}
          >
            <Text
              className={`font-ui ${done && f.winner_entry_id === (side === 'a' ? f.team_a_entry_id : f.team_b_entry_id) ? 'font-bold text-ink-black' : 'text-text-secondary'}`}
              style={{ fontSize: 15 }}
            >
              {name ?? 'To be decided'}
            </Text>
            <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 14 }}>
              {scoreText(f, side)}
            </Text>
          </View>
        ))}
        {f.scheduled_at && !done && (
          <Text className="font-ui text-text-tertiary" style={{ fontSize: 12, marginTop: 6 }}>
            {new Date(f.scheduled_at).toLocaleString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        )}
        {done && (
          <Text
            className="font-ui font-bold text-brand-red"
            style={{ fontSize: 13, marginTop: 6 }}
            testID={`result-${f.match_number}`}
          >
            {resultLine(f)}
          </Text>
        )}
        {f.stage === 'KNOCKOUT' && !done && f.match_status === 'COMPLETED' && (
          <Text
            className="font-ui font-bold text-brand-red"
            style={{ fontSize: 13, marginTop: 6 }}
            testID={`tie-${f.match_number}`}
          >
            Level at the end. The host is choosing who goes through.
          </Text>
        )}
        {live && (
          <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <PillButton
              label={f.match_status === 'IN_PROGRESS' ? 'Watch live' : 'Match details'}
              icon="radio"
              onPress={() => router.push(`/(tabs)/matches/${f.match_id}/live`)}
              testID={`watch-${f.match_number}`}
            />
          </View>
        )}
      </HubCard>
    );
  };

  return (
    <HubScreen
      title={t.name}
      subtitle={`${FORMAT_LABEL[t.format]} · ${t.overs_per_innings} overs${t.turf_name ? ` · ${t.turf_name}` : ''}`}
      backTestID="tournament-back"
      testID="tournament-screen"
      controls={
        <PillTabs<Tab>
          testIDPrefix="tournament-tab"
          value={tab}
          onChange={setTab}
          items={tabs}
          scroll
        />
      }
    >
      {t.status === 'COMPLETED' && t.champion_name ? (
        <HeroCard testID="champion-card">
          <Text
            className="font-ui"
            style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' }}
          >
            CHAMPIONS
          </Text>
          <Text
            className="font-ui font-bold"
            style={{ fontSize: 24, color: '#FFFFFF', marginTop: 4 }}
          >
            {t.champion_name}
          </Text>
        </HeroCard>
      ) : (
        <HubCard>
          <View className="flex-row items-center justify-between">
            <Chip
              text={STATUS_LABEL[t.status].toUpperCase()}
              tone={t.status === 'IN_PROGRESS' ? 'solid' : 'red'}
            />
            <Text
              className="font-display text-brand-red"
              style={{ fontSize: 20 }}
              testID="tournament-fee"
            >
              {fee > 0 ? `₹${fee.toLocaleString('en-IN')} entry` : 'Free entry'}
            </Text>
          </View>
          <Text className="font-ui text-text-secondary" style={{ fontSize: 13, marginTop: 8 }}>
            {approved.length}/{t.max_teams} teams
            {day(t.start_date) ? ` · starts ${day(t.start_date)}` : ''}
            {day(t.registration_deadline) && entriesOpen
              ? ` · entries close ${day(t.registration_deadline)}`
              : ''}
          </Text>
          {t.description ? (
            <Text className="font-ui text-text-secondary" style={{ fontSize: 13, marginTop: 8 }}>
              {t.description}
            </Text>
          ) : null}
        </HubCard>
      )}

      {message && (
        <HubMessage tone="ok" testID="tournament-message">
          {message}
        </HubMessage>
      )}
      {error && (
        <HubMessage tone="error" testID="tournament-error-msg">
          {error}
        </HubMessage>
      )}

      {/* Your team(s) */}
      {myEntries.map((e) => (
        <HubCard key={e.entry_id} testID={`my-entry-${e.entry_id}`}>
          <View className="flex-row items-center">
            <IconBadge icon="shield-account" size={40} />
            <View className="flex-1" style={{ marginLeft: 12 }}>
              <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 16 }}>
                {e.team_name}
              </Text>
              <Text className="font-ui text-text-tertiary" style={{ fontSize: 12 }}>
                Your team
              </Text>
            </View>
            <Chip
              text={ENTRY_LABEL[e.status]}
              tone={e.status === 'APPROVED' ? 'solid' : 'red'}
              testID={`entry-status-${e.entry_id}`}
            />
          </View>

          {e.payment_status !== 'NOT_REQUIRED' && (
            <View style={{ marginTop: 12 }}>
              {e.payment_status === 'PAID' ? (
                <Text
                  className="font-ui font-bold text-ink-black"
                  style={{ fontSize: 13 }}
                  testID={`entry-paid-${e.entry_id}`}
                >
                  Entry fee paid ✓
                </Text>
              ) : entriesOpen ? (
                <>
                  <Text
                    className="font-ui text-text-secondary"
                    style={{ fontSize: 13, marginBottom: 8 }}
                  >
                    Entry fee ₹{fee.toLocaleString('en-IN')} — pay online, or hand cash to the host
                    and they will mark it paid.
                  </Text>
                  <View className="flex-row" style={{ gap: 8 }}>
                    <PillButton
                      label="Pay by UPI"
                      onPress={() => payOnline(e, 'UPI')}
                      disabled={busy}
                      testID={`pay-upi-${e.entry_id}`}
                    />
                    <PillButton
                      label="Card / Gateway"
                      variant="outline"
                      onPress={() => payOnline(e, 'RAZORPAY')}
                      disabled={busy}
                      testID={`pay-gateway-${e.entry_id}`}
                    />
                  </View>
                </>
              ) : (
                <Text className="font-ui text-text-tertiary" style={{ fontSize: 13 }}>
                  Entry fee not yet recorded as paid.
                </Text>
              )}
            </View>
          )}

          {entriesOpen && (
            <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
              <PillButton
                label="Withdraw team"
                variant="outline"
                onPress={() => withdraw(e)}
                disabled={busy}
                testID={`withdraw-${e.entry_id}`}
              />
            </View>
          )}
        </HubCard>
      ))}

      {/* Enter a team */}
      {entriesOpen && freeTeams.length > 0 && (
        <HubCard testID="enter-team-card">
          <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 15 }}>
            Enter your team
          </Text>
          <Text className="font-ui text-text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
            {freeTeams.length === 1
              ? `Captain of ${freeTeams[0].team_name}.`
              : 'You captain more than one team.'}{' '}
            The host approves entries.
          </Text>
          {freeTeams.length === 1 ? (
            <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
              <PillButton
                label={`Enter ${freeTeams[0].team_name}`}
                onPress={() => enter(freeTeams[0])}
                disabled={busy}
                testID="enter-team"
              />
            </View>
          ) : picking ? (
            <View style={{ marginTop: 8 }}>
              {freeTeams.map((team) => (
                <View key={team.team_id} style={{ marginTop: 8, alignItems: 'flex-start' }}>
                  <PillButton
                    label={team.team_name}
                    variant="outline"
                    onPress={() => enter(team)}
                    disabled={busy}
                    testID={`enter-${team.team_id}`}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
              <PillButton
                label="Choose a team"
                onPress={() => setPicking(true)}
                testID="enter-team"
              />
            </View>
          )}
        </HubCard>
      )}
      {entriesOpen && captainOf.length === 0 && (
        <HubMessage testID="not-captain">
          Only a team’s captain can enter it. Create a team from the Teams tab to take part.
        </HubMessage>
      )}

      {tab === 'teams' && (
        <>
          <SectionLabel>Teams</SectionLabel>
          {approved.length === 0 && (
            <HubMessage testID="no-teams">No teams have been accepted yet.</HubMessage>
          )}
          {approved.map((e) => (
            <HubCard key={e.entry_id} testID={`team-${e.entry_id}`} style={{ paddingVertical: 12 }}>
              <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 15 }}>
                {e.team_name}
              </Text>
            </HubCard>
          ))}
        </>
      )}

      {tab === 'fixtures' && (
        <>
          {detail.fixtures.length === 0 ? (
            <HubMessage testID="no-fixtures">
              Fixtures appear when the tournament starts.
            </HubMessage>
          ) : (
            detail.fixtures.map(fixtureCard)
          )}
        </>
      )}

      {tab === 'table' &&
        (!hasLeague ? (
          <HubMessage testID="no-table">
            The points table appears once the league starts.
          </HubMessage>
        ) : (
          <HubCard testID="points-table" style={{ padding: 0, overflow: 'hidden' }}>
            <View
              className="flex-row"
              style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F8F8F8' }}
            >
              {['#', 'TEAM', 'P', 'W', 'L', 'PTS', 'NRR'].map((h, i) => (
                <Text
                  key={h}
                  className="font-ui font-bold text-text-tertiary"
                  style={{
                    fontSize: 10,
                    flex: i === 1 ? 4 : 1,
                    textAlign: i < 2 ? 'left' : 'right',
                  }}
                >
                  {h}
                </Text>
              ))}
            </View>
            {detail.table.map((r) => (
              <View
                key={r.team_id}
                className="flex-row"
                style={{
                  paddingVertical: 11,
                  paddingHorizontal: 12,
                  borderTopWidth: 1,
                  borderTopColor: '#EEEDEE',
                }}
                testID={`row-${r.rank}`}
              >
                <Text
                  className="font-ui font-bold text-ink-black"
                  style={{ flex: 1, fontSize: 13 }}
                >
                  {r.rank}
                </Text>
                <Text
                  className="font-ui font-bold text-ink-black"
                  style={{ flex: 4, fontSize: 13 }}
                  numberOfLines={1}
                >
                  {r.name}
                </Text>
                <Text
                  className="font-ui text-text-secondary"
                  style={{ flex: 1, fontSize: 13, textAlign: 'right' }}
                >
                  {r.played}
                </Text>
                <Text
                  className="font-ui text-text-secondary"
                  style={{ flex: 1, fontSize: 13, textAlign: 'right' }}
                >
                  {r.won}
                </Text>
                <Text
                  className="font-ui text-text-secondary"
                  style={{ flex: 1, fontSize: 13, textAlign: 'right' }}
                >
                  {r.lost}
                </Text>
                <Text
                  className="font-ui font-bold text-brand-red"
                  style={{ flex: 1, fontSize: 13, textAlign: 'right' }}
                >
                  {r.points}
                </Text>
                <Text
                  className="font-ui text-text-secondary"
                  style={{ flex: 1, fontSize: 12, textAlign: 'right' }}
                >
                  {r.nrr > 0 ? '+' : ''}
                  {r.nrr.toFixed(2)}
                </Text>
              </View>
            ))}
          </HubCard>
        ))}

      {tab === 'bracket' && hasKnockout && (
        <View testID="bracket">
          {[
            ...new Set(
              detail.fixtures.filter((f) => f.stage === 'KNOCKOUT').map((f) => f.round_number),
            ),
          ]
            .sort((a, b) => a - b)
            .map((round) => {
              const list = detail.fixtures.filter(
                (f) => f.stage === 'KNOCKOUT' && f.round_number === round,
              );
              return (
                <View key={round}>
                  <SectionLabel>{list[0].stage_label}</SectionLabel>
                  {list.map(fixtureCard)}
                </View>
              );
            })}
        </View>
      )}
    </HubScreen>
  );
}
