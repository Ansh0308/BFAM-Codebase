'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ClipboardEdit,
  Flag,
  IndianRupee,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type {
  OpenTeam,
  TournamentDetail,
  TournamentEntry,
  TournamentFixture,
} from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { formatRupees } from '../../lib/dates';
import { PageHeader } from '../DashboardShell';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Drawer } from '../ui/Drawer';
import { EASE_OUT } from '../ui/motion';
import { useToast } from '../ui/Toast';
import {
  Button,
  EmptyState,
  SearchInput,
  SegmentedControl,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../ui/kit';
import { FORMAT_LABEL, STATUS_LABEL, STATUS_TONE, TournamentForm } from './TournamentList';

type Tab = 'teams' | 'fixtures' | 'table' | 'bracket';
type Confirm = null | 'start' | 'cancel' | 'delete' | 'knockout';

const ENTRY_TONE: Record<TournamentEntry['status'], Tone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'neutral',
};

const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[40px] font-ui text-body text-text-primary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
const LABEL = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

// One tournament, for Admin and Owner Web: teams & payments, fixtures with
// result entry, the points table and the knockout bracket.
export function TournamentView({
  tournamentId,
  backHref,
}: {
  tournamentId: string;
  backHref: string;
}) {
  const toast = useToast();
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('teams');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editing, setEditing] = useState(false);
  const [resultFor, setResultFor] = useState<TournamentFixture | null>(null);
  const [payFor, setPayFor] = useState<TournamentEntry | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await apiClient.getTournament(tournamentId));
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

  // Opens on the most useful tab for the stage it is in.
  const status = detail?.tournament.status;
  useEffect(() => {
    if (status === 'IN_PROGRESS') setTab('fixtures');
    else if (status === 'COMPLETED') setTab('table');
  }, [status]);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'That didn’t work.');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  if (loading) {
    return (
      <div data-testid="tournament-loading">
        <PageHeader title="Tournament" />
        <SkeletonRows rows={4} />
      </div>
    );
  }
  if (!detail) {
    return (
      <div data-testid="tournament-error">
        <PageHeader title="Tournament" />
        <EmptyState
          icon={Trophy}
          title="Couldn’t open this tournament"
          message={error ?? 'Not found.'}
          action={
            <Link href={backHref}>
              <Button variant="secondary" icon={ArrowLeft}>
                Back
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const t = detail.tournament;
  const manage = detail.can_manage;
  const preStart = t.status === 'DRAFT' || t.status === 'REGISTRATION_OPEN';
  const approved = detail.entries.filter((e) => e.status === 'APPROVED');
  const hasKnockout = detail.fixtures.some((f) => f.stage === 'KNOCKOUT');
  const hasLeague = detail.fixtures.some((f) => f.stage === 'LEAGUE');
  const fee = Number(t.entry_fee);
  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'teams', label: 'Teams', count: approved.length },
    { value: 'fixtures', label: 'Fixtures', count: detail.fixtures.length },
    ...(t.format !== 'KNOCKOUT' ? [{ value: 'table' as Tab, label: 'Points table' }] : []),
    ...(hasKnockout ? [{ value: 'bracket' as Tab, label: 'Bracket' }] : []),
  ];

  async function move(entryId: string, delta: -1 | 1) {
    const ids = approved
      .slice()
      .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
      .map((e) => e.entry_id);
    const i = ids.indexOf(entryId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await act(() => apiClient.setTournamentSeeds(tournamentId, ids), 'Seeding updated');
  }

  return (
    <div data-testid="tournament-view">
      <PageHeader
        title={t.name}
        subtitle={`${FORMAT_LABEL[t.format]} · ${t.overs_per_innings} overs${t.turf_name ? ` · ${t.turf_name}` : ''}`}
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <StatusPill
              label={STATUS_LABEL[t.status]}
              tone={STATUS_TONE[t.status]}
              pulse={t.status === 'IN_PROGRESS'}
            />
            <Link href={backHref}>
              <Button variant="secondary" icon={ArrowLeft} testID="tournament-back">
                All tournaments
              </Button>
            </Link>
          </div>
        }
      />

      {t.status === 'COMPLETED' && t.champion_name && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="relative mb-6 overflow-hidden rounded-lg bg-brand-red p-6 text-white shadow-[0_18px_44px_rgba(216,0,0,0.3)]"
          data-testid="champion-banner"
        >
          <span
            aria-hidden
            className="absolute -right-10 -top-10 h-[180px] w-[180px] rounded-[999px] bg-white/10"
          />
          <p className="relative flex items-center gap-2 font-ui text-micro uppercase tracking-[0.16em] text-white/80">
            <Trophy className="h-[16px] w-[16px]" /> Champions
          </p>
          <p className="relative mt-1 font-display text-[48px] leading-none tracking-wide">
            {t.champion_name}
          </p>
        </motion.div>
      )}

      {/* Facts + organiser actions */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface p-5">
        <dl className="flex flex-wrap gap-x-8 gap-y-2 font-ui text-body">
          <Fact label="Entry fee" value={fee > 0 ? formatRupees(fee) : 'Free'} />
          <Fact label="Teams" value={`${approved.length} / ${t.max_teams} (min ${t.min_teams})`} />
          {t.start_date && (
            <Fact
              label="Starts"
              value={new Date(`${t.start_date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            />
          )}
          {t.registration_deadline && (
            <Fact
              label="Entries close"
              value={new Date(
                `${t.registration_deadline.slice(0, 10)}T00:00:00`,
              ).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            />
          )}
        </dl>
        {manage && (
          <div className="flex flex-wrap gap-2">
            {preStart && (
              <Button
                size="sm"
                variant="soft"
                icon={Pencil}
                onClick={() => setEditing(true)}
                testID="edit-tournament"
              >
                Edit
              </Button>
            )}
            {t.status === 'DRAFT' && (
              <Button
                size="sm"
                variant="secondary"
                icon={Flag}
                loading={busy}
                onClick={() =>
                  act(
                    () => apiClient.openTournamentRegistration(tournamentId),
                    'Registration is open',
                  )
                }
                testID="open-registration"
              >
                Open registration
              </Button>
            )}
            {preStart && (
              <Button
                size="sm"
                icon={Play}
                onClick={() => setConfirm('start')}
                testID="start-tournament"
              >
                Start tournament
              </Button>
            )}
            {detail.can_start_knockout && (
              <Button
                size="sm"
                icon={Trophy}
                onClick={() => setConfirm('knockout')}
                testID="start-knockout"
              >
                Start knockout
              </Button>
            )}
            {(preStart || t.status === 'IN_PROGRESS') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirm('cancel')}
                testID="cancel-tournament"
              >
                Cancel
              </Button>
            )}
            {(t.status === 'DRAFT' || t.status === 'CANCELLED') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirm('delete')}
                testID="delete-tournament"
              >
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {t.description && (
        <p className="mb-6 max-w-3xl font-ui text-body text-text-secondary">{t.description}</p>
      )}

      <div className="mb-6">
        <SegmentedControl<Tab>
          testIDPrefix="tournament-tab"
          value={tab}
          onChange={setTab}
          options={tabs}
        />
      </div>

      {tab === 'teams' && (
        <TeamsPanel
          detail={detail}
          preStart={preStart}
          busy={busy}
          onReview={(e, d) =>
            act(
              () => apiClient.reviewTournamentEntry(e.entry_id, d),
              d === 'APPROVED' ? 'Team approved' : 'Team rejected',
            )
          }
          onRemove={(e) => act(() => apiClient.removeTournamentEntry(e.entry_id), 'Team removed')}
          onPay={(e) => setPayFor(e)}
          onMove={move}
          onAdd={(team) =>
            act(
              () => apiClient.addTournamentTeam(tournamentId, team.team_id),
              `${team.team_name} added`,
            )
          }
        />
      )}

      {tab === 'fixtures' &&
        (detail.fixtures.length === 0 ? (
          <EmptyState
            icon={Flag}
            title="No fixtures yet"
            message="Fixtures are created when the tournament starts."
            testID="fixtures-empty"
          />
        ) : (
          <FixtureList
            fixtures={detail.fixtures}
            manage={manage && t.status === 'IN_PROGRESS'}
            onResult={setResultFor}
            onReopen={(f) =>
              act(() => apiClient.reopenTournamentFixture(f.fixture_id), 'Result reopened')
            }
          />
        ))}

      {tab === 'table' &&
        (!hasLeague ? (
          <EmptyState
            icon={Trophy}
            title="No table yet"
            message="The points table appears once the league starts."
            testID="table-empty"
          />
        ) : (
          <PointsTable
            rows={detail.table}
            qualifiers={t.format === 'LEAGUE_KNOCKOUT' ? (approved.length >= 4 ? 4 : 2) : 0}
          />
        ))}

      {tab === 'bracket' && hasKnockout && (
        <Bracket
          fixtures={detail.fixtures.filter((f) => f.stage === 'KNOCKOUT')}
          manage={manage && t.status === 'IN_PROGRESS'}
          onResult={setResultFor}
        />
      )}

      {/* Result entry */}
      <Drawer
        open={resultFor !== null}
        onClose={() => setResultFor(null)}
        title="Match result"
        subtitle={resultFor ? `${resultFor.team_a_name} v ${resultFor.team_b_name}` : undefined}
        testID="result-drawer"
      >
        {resultFor && (
          <ResultForm
            fixture={resultFor}
            overs={t.overs_per_innings}
            onSaved={async () => {
              toast.success('Result saved');
              setResultFor(null);
              await load();
            }}
          />
        )}
      </Drawer>

      <Drawer
        open={payFor !== null}
        onClose={() => setPayFor(null)}
        title="Entry fee"
        subtitle={payFor?.team_name}
        width={440}
        testID="pay-drawer"
      >
        {payFor && (
          <PayForm
            entry={payFor}
            fee={fee}
            onSaved={async () => {
              toast.success('Payment updated');
              setPayFor(null);
              await load();
            }}
          />
        )}
      </Drawer>

      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit tournament"
        testID="edit-drawer"
      >
        {editing && (
          <TournamentForm
            tournamentId={tournamentId}
            submitLabel="Save changes"
            initial={{
              name: t.name,
              description: t.description,
              format: t.format,
              overs_per_innings: t.overs_per_innings,
              entry_fee: fee,
              min_teams: t.min_teams,
              max_teams: t.max_teams,
              double_round: Boolean(t.double_round),
              start_date: t.start_date,
              registration_deadline: t.registration_deadline,
              turf_id: t.turf_id,
            }}
            turfs={
              t.turf_id ? [{ turf_id: t.turf_id, turf_name: t.turf_name ?? 'Turf' }] : undefined
            }
            onSaved={async () => {
              toast.success('Tournament updated');
              setEditing(false);
              await load();
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={confirm === 'start'}
        title="Start the tournament?"
        message={`Fixtures are created for the ${approved.length} approved teams and entries close. Pending teams are left out.`}
        confirmLabel="Start"
        busy={busy}
        onConfirm={() => act(() => apiClient.startTournament(tournamentId), 'Tournament started')}
        onCancel={() => setConfirm(null)}
        testID="start-dialog"
      />
      <ConfirmDialog
        open={confirm === 'knockout'}
        title="Start the knockout?"
        message="The top teams in the points table go through and the bracket is created. League results are then locked."
        confirmLabel="Start knockout"
        busy={busy}
        onConfirm={() =>
          act(() => apiClient.startTournamentKnockout(tournamentId), 'Knockout started')
        }
        onCancel={() => setConfirm(null)}
        testID="knockout-dialog"
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancel this tournament?"
        message="Teams will see it as cancelled. This can’t be undone."
        confirmLabel="Cancel tournament"
        cancelLabel="Keep it"
        busy={busy}
        onConfirm={() =>
          act(() => apiClient.cancelTournament(tournamentId), 'Tournament cancelled')
        }
        onCancel={() => setConfirm(null)}
        testID="cancel-dialog"
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this tournament?"
        message="It is removed for good."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await apiClient.deleteTournament(tournamentId);
            window.location.assign(backHref);
          } catch (err) {
            toast.error(err instanceof BFAMApiError ? err.message : 'Could not delete it.');
            setBusy(false);
            setConfirm(null);
          }
        }}
        onCancel={() => setConfirm(null)}
        testID="delete-dialog"
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-ui text-micro uppercase tracking-wider text-text-tertiary">{label}</dt>
      <dd className="font-ui text-body font-semibold text-ink-black">{value}</dd>
    </div>
  );
}

// ---- Teams -------------------------------------------------------------------

function TeamsPanel({
  detail,
  preStart,
  busy,
  onReview,
  onRemove,
  onPay,
  onMove,
  onAdd,
}: {
  detail: TournamentDetail;
  preStart: boolean;
  busy: boolean;
  onReview: (e: TournamentEntry, d: 'APPROVED' | 'REJECTED') => void;
  onRemove: (e: TournamentEntry) => void;
  onPay: (e: TournamentEntry) => void;
  onMove: (entryId: string, delta: -1 | 1) => void;
  onAdd: (team: OpenTeam) => void;
}) {
  const manage = detail.can_manage;
  const entries = detail.entries
    .filter((e) => e.status !== 'WITHDRAWN')
    .sort(
      (a, b) =>
        (a.status === 'PENDING' ? -1 : 0) - (b.status === 'PENDING' ? -1 : 0) ||
        (a.seed ?? 999) - (b.seed ?? 999),
    );
  const seedable = detail.tournament.format !== 'LEAGUE';

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        {entries.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No teams yet"
            message={
              manage
                ? 'Add a team, or open registration so captains can apply.'
                : 'No teams have entered yet.'
            }
            testID="teams-empty"
          />
        ) : (
          <ul className="space-y-3" data-testid="entry-list">
            {entries.map((e, i) => (
              <li
                key={e.entry_id}
                data-testid={`entry-${e.entry_id}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-surface px-5 py-4"
              >
                {seedable && e.status === 'APPROVED' && (
                  <span
                    className="grid h-[28px] w-[28px] place-items-center rounded-[999px] bg-ink-black font-ui text-[12px] font-bold text-white"
                    title="Seed"
                  >
                    {i + 1}
                  </span>
                )}
                <div className="min-w-[160px] flex-1">
                  <p className="font-ui text-card-title font-bold text-ink-black">{e.team_name}</p>
                  {manage && e.registered_by_phone && (
                    <p className="font-ui text-micro text-text-tertiary">
                      Entered by {e.registered_by_phone}
                    </p>
                  )}
                </div>
                <StatusPill label={e.status} tone={ENTRY_TONE[e.status]} />
                {e.payment_status !== 'NOT_REQUIRED' && (
                  <StatusPill
                    label={e.payment_status === 'PAID' ? 'Paid' : 'Unpaid'}
                    tone={e.payment_status === 'PAID' ? 'success' : 'warning'}
                  />
                )}
                {manage && preStart && (
                  <div className="flex flex-wrap items-center gap-2">
                    {e.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          icon={Check}
                          loading={busy}
                          onClick={() => onReview(e, 'APPROVED')}
                          testID={`approve-${e.entry_id}`}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="soft"
                          icon={X}
                          onClick={() => onReview(e, 'REJECTED')}
                          testID={`reject-${e.entry_id}`}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {e.payment_status !== 'NOT_REQUIRED' && e.status !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="soft"
                        icon={IndianRupee}
                        onClick={() => onPay(e)}
                        testID={`pay-${e.entry_id}`}
                      >
                        {e.payment_status === 'PAID' ? 'Payment' : 'Mark paid'}
                      </Button>
                    )}
                    {seedable && e.status === 'APPROVED' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={ArrowUp}
                          ariaLabel={`Move ${e.team_name} up`}
                          onClick={() => onMove(e.entry_id, -1)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={ArrowDown}
                          ariaLabel={`Move ${e.team_name} down`}
                          onClick={() => onMove(e.entry_id, 1)}
                        />
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemove(e)}
                      testID={`remove-${e.entry_id}`}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {seedable && manage && preStart && entries.some((e) => e.status === 'APPROVED') && (
          <p className="mt-3 font-ui text-micro text-text-tertiary">
            Order sets the seeding for the knockout bracket — seed 1 meets the lowest seed first.
          </p>
        )}
      </div>

      {manage && preStart && <AddTeam onAdd={onAdd} />}
    </div>
  );
}

function AddTeam({ onAdd }: { onAdd: (team: OpenTeam) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenTeam[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setResults((await apiClient.searchTeams(query.trim())).results);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  return (
    <aside className="rounded-lg border border-border-subtle bg-surface p-5" data-testid="add-team">
      <p className="mb-3 flex items-center gap-2 font-ui text-card-title font-bold text-ink-black">
        <UserPlus className="h-[18px] w-[18px] text-brand-red" /> Add a team
      </p>
      <SearchInput
        value={query}
        onChange={setQuery}
        onSubmit={search}
        loading={searching}
        placeholder="Search team name"
        ariaLabel="Search teams"
        testID="team-search"
      />
      <Button
        size="sm"
        variant="soft"
        icon={Search}
        onClick={search}
        className="mt-3"
        testID="team-search-go"
      >
        Search
      </Button>
      <ul className="mt-4 space-y-2" data-testid="team-results">
        {results.map((t) => (
          <li
            key={t.team_id}
            className="flex items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2"
          >
            <span className="min-w-0 truncate font-ui text-body font-semibold text-ink-black">
              {t.team_name}
              <span className="ml-2 font-normal text-text-tertiary">{t.home_city ?? ''}</span>
            </span>
            <Button size="sm" onClick={() => onAdd(t)} testID={`add-${t.team_id}`}>
              Add
            </Button>
          </li>
        ))}
        {searched && results.length === 0 && (
          <li className="font-ui text-body text-text-tertiary">No teams found.</li>
        )}
      </ul>
    </aside>
  );
}

function PayForm({
  entry,
  fee,
  onSaved,
}: {
  entry: TournamentEntry;
  fee: number;
  onSaved: () => void;
}) {
  const [reference, setReference] = useState(entry.payment_reference ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = entry.payment_status === 'PAID';

  async function save(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      await apiClient.setTournamentEntryPaid(entry.entry_id, next, reference.trim() || null);
      onSaved();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not update the payment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-testid="pay-form">
      <p className="mb-4 font-ui text-body text-text-secondary">
        Entry fee <strong>{formatRupees(fee)}</strong>. Record it once the captain has paid you
        (cash, UPI or bank transfer).
      </p>
      <label className="mb-5 block">
        <span className={LABEL}>Reference (optional)</span>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="UPI ref / receipt no."
          data-testid="pay-reference"
          className={FIELD}
        />
      </label>
      {error && (
        <p role="alert" className="mb-4 font-ui text-body text-brand-red">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button loading={saving} onClick={() => save(true)} testID="pay-confirm">
          {paid ? 'Update reference' : 'Mark as paid'}
        </Button>
        {paid && (
          <Button variant="soft" onClick={() => save(false)} testID="pay-undo">
            Mark unpaid
          </Button>
        )}
      </div>
    </div>
  );
}

// ---- Fixtures ----------------------------------------------------------------

function FixtureCard({
  f,
  manage,
  onResult,
  onReopen,
}: {
  f: TournamentFixture;
  manage: boolean;
  onResult: (f: TournamentFixture) => void;
  onReopen?: (f: TournamentFixture) => void;
}) {
  const done = f.status === 'COMPLETED';
  const ready = !!f.team_a_entry_id && !!f.team_b_entry_id;
  const winnerA = done && f.winner_entry_id === f.team_a_entry_id;
  const winnerB = done && f.winner_entry_id === f.team_b_entry_id;
  const row = (name: string | null, score: string, win: boolean) => (
    <div className="flex items-center justify-between gap-3">
      <span
        className={`truncate font-ui text-body ${win ? 'font-bold text-ink-black' : 'text-text-secondary'} ${name ? '' : 'italic text-text-tertiary'}`}
      >
        {name ?? 'To be decided'}
      </span>
      <span className="shrink-0 font-ui text-body font-semibold text-ink-black">{score}</span>
    </div>
  );
  return (
    <div
      data-testid={`fixture-${f.match_number}`}
      className={`rounded-lg border bg-surface p-4 ${done ? 'border-border-subtle' : 'border-brand-red/25'}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-ui text-micro uppercase tracking-wide text-text-tertiary">
          Match {f.match_number} · {f.stage_label}
        </span>
        {done ? (
          <StatusPill label="Done" tone="success" />
        ) : (
          <StatusPill label={ready ? 'Scheduled' : 'Waiting'} tone={ready ? 'info' : 'neutral'} />
        )}
      </div>
      {row(f.team_a_name, scoreText(f, 'a'), winnerA)}
      <div className="my-1 h-px bg-border-subtle" />
      {row(f.team_b_name, scoreText(f, 'b'), winnerB)}
      {(f.scheduled_at || f.venue_note) && (
        <p className="mt-2 font-ui text-micro text-text-tertiary">
          {when(f.scheduled_at)}
          {f.venue_note ? ` · ${f.venue_note}` : ''}
        </p>
      )}
      {done && (
        <p
          className="mt-2 font-ui text-[13px] font-semibold text-brand-red"
          data-testid={`result-${f.match_number}`}
        >
          {resultLine(f)}
        </p>
      )}
      {manage && (
        <div className="mt-3 flex gap-2">
          {!done && ready && (
            <Button
              size="sm"
              icon={ClipboardEdit}
              onClick={() => onResult(f)}
              testID={`enter-result-${f.match_number}`}
            >
              Enter result
            </Button>
          )}
          {done && onReopen && (
            <Button
              size="sm"
              variant="soft"
              icon={RotateCcw}
              onClick={() => onReopen(f)}
              testID={`reopen-${f.match_number}`}
            >
              Reopen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FixtureList({
  fixtures,
  manage,
  onResult,
  onReopen,
}: {
  fixtures: TournamentFixture[];
  manage: boolean;
  onResult: (f: TournamentFixture) => void;
  onReopen: (f: TournamentFixture) => void;
}) {
  const groups = new Map<string, TournamentFixture[]>();
  for (const f of fixtures) {
    const key = `${f.stage}-${f.round_number}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return (
    <div className="space-y-6" data-testid="fixture-list">
      {[...groups.entries()].map(([key, list]) => (
        <section key={key}>
          <h3 className="mb-3 font-ui text-micro uppercase tracking-wider text-text-secondary">
            {list[0].stage === 'KNOCKOUT' ? '' : 'League · '}
            {list[0].stage_label}
          </h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((f) => (
              <FixtureCard
                key={f.fixture_id}
                f={f}
                manage={manage}
                onResult={onResult}
                onReopen={onReopen}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---- Points table & bracket ----------------------------------------------------

function PointsTable({
  rows,
  qualifiers,
}: {
  rows: TournamentDetail['table'];
  qualifiers: number;
}) {
  return (
    <div
      className="overflow-x-auto rounded-lg border border-border-subtle bg-surface"
      data-testid="points-table"
    >
      <table className="min-w-full text-left">
        <thead>
          <tr className="border-b border-border-subtle bg-ink-black/[0.03] font-ui text-micro uppercase tracking-wide text-text-secondary">
            {['#', 'Team', 'P', 'W', 'L', 'T', 'NR', 'Pts', 'NRR'].map((h) => (
              <th key={h} className={`px-4 py-3 ${h === 'Team' || h === '#' ? '' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <motion.tr
              key={r.team_id}
              layout
              data-testid={`row-${r.rank}`}
              className={`border-b border-border-subtle last:border-0 ${qualifiers && r.rank <= qualifiers ? 'bg-brand-red/[0.04]' : ''}`}
            >
              <td className="px-4 py-3 font-ui text-body font-bold text-ink-black">{r.rank}</td>
              <td className="px-4 py-3 font-ui text-body font-semibold text-ink-black">{r.name}</td>
              <td className="px-4 py-3 text-right font-ui text-body">{r.played}</td>
              <td className="px-4 py-3 text-right font-ui text-body">{r.won}</td>
              <td className="px-4 py-3 text-right font-ui text-body">{r.lost}</td>
              <td className="px-4 py-3 text-right font-ui text-body">{r.tied}</td>
              <td className="px-4 py-3 text-right font-ui text-body">{r.no_result}</td>
              <td className="px-4 py-3 text-right font-ui text-body font-bold text-brand-red">
                {r.points}
              </td>
              <td className="px-4 py-3 text-right font-ui text-body text-text-secondary">
                {r.nrr > 0 ? '+' : ''}
                {r.nrr.toFixed(3)}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 font-ui text-micro text-text-tertiary">
        Win 2 points, tie or no result 1. Ties on points are split by wins, then net run rate.
        {qualifiers ? ` Shaded teams go through to the knockout.` : ''}
      </p>
    </div>
  );
}

function Bracket({
  fixtures,
  manage,
  onResult,
}: {
  fixtures: TournamentFixture[];
  manage: boolean;
  onResult: (f: TournamentFixture) => void;
}) {
  const rounds = [...new Set(fixtures.map((f) => f.round_number))].sort((a, b) => a - b);
  return (
    <div className="flex gap-6 overflow-x-auto pb-2" data-testid="bracket">
      {rounds.map((r) => {
        const list = fixtures.filter((f) => f.round_number === r);
        return (
          <div key={r} className="flex min-w-[260px] flex-col justify-around gap-4">
            <h3 className="font-ui text-micro uppercase tracking-wider text-text-secondary">
              {list[0].stage_label}
            </h3>
            {list.map((f) => (
              <FixtureCard key={f.fixture_id} f={f} manage={manage} onResult={onResult} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---- Result entry --------------------------------------------------------------

function ResultForm({
  fixture,
  overs,
  onSaved,
}: {
  fixture: TournamentFixture;
  overs: number;
  onSaved: () => void;
}) {
  const knockout = fixture.stage === 'KNOCKOUT';
  const [type, setType] = useState<'WIN' | 'TIE' | 'NO_RESULT'>('WIN');
  const [winner, setWinner] = useState<string | null>(null);
  const [aRuns, setARuns] = useState('');
  const [aWkts, setAWkts] = useState('');
  const [aOvers, setAOvers] = useState('');
  const [bRuns, setBRuns] = useState('');
  const [bWkts, setBWkts] = useState('');
  const [bOvers, setBOvers] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsScores = !knockout && type !== 'NO_RESULT';
  const needsWinner = type === 'WIN' || knockout;
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function submit() {
    if (needsWinner && !winner)
      return setError(
        knockout && type !== 'WIN'
          ? 'Pick who goes through (e.g. after a super over).'
          : 'Choose which team won.',
      );
    if (needsScores && (aRuns === '' || aOvers === '' || bRuns === '' || bOvers === '')) {
      return setError('Enter runs and overs for both teams — they decide net run rate.');
    }
    for (const o of [aOvers, bOvers]) {
      if (o === '') continue;
      const n = Number(o);
      if (!(n >= 0) || n > overs) return setError(`Overs can’t exceed ${overs}.`);
      if (Math.round((n - Math.floor(n)) * 10) > 5)
        return setError('Write overs like 5.3 (5 overs, 3 balls).');
    }
    setError(null);
    setSaving(true);
    try {
      await apiClient.recordTournamentResult(fixture.fixture_id, {
        result_type: type,
        winner_entry_id: needsWinner ? winner : null,
        team_a_runs: num(aRuns),
        team_a_wickets: num(aWkts),
        team_a_overs: num(aOvers),
        team_b_runs: num(bRuns),
        team_b_wickets: num(bWkts),
        team_b_overs: num(bOvers),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save the result.');
    } finally {
      setSaving(false);
    }
  }

  const scoreInputs = (
    label: string,
    runs: string,
    setRuns: (v: string) => void,
    wkts: string,
    setWkts: (v: string) => void,
    ov: string,
    setOv: (v: string) => void,
    key: string,
  ) => (
    <div className="mb-4">
      <p className="mb-1 font-ui text-body font-bold text-ink-black">{label}</p>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className={LABEL}>Runs</span>
          <input
            type="number"
            min="0"
            value={runs}
            onChange={(e) => setRuns(e.target.value)}
            data-testid={`${key}-runs`}
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Wickets</span>
          <input
            type="number"
            min="0"
            value={wkts}
            onChange={(e) => setWkts(e.target.value)}
            data-testid={`${key}-wkts`}
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Overs</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={ov}
            onChange={(e) => setOv(e.target.value)}
            data-testid={`${key}-overs`}
            className={FIELD}
            placeholder={String(overs)}
          />
        </label>
      </div>
    </div>
  );

  const chip = (active: boolean, onClick: () => void, text: string, id: string) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={id}
      className={`h-[40px] rounded-md px-4 font-ui text-[13px] font-bold cursor-pointer transition-colors ${active ? 'bg-brand-red text-white shadow-[0_6px_18px_rgba(216,0,0,0.28)]' : 'bg-ink-black/[0.05] text-ink-black hover:bg-ink-black/[0.1]'}`}
    >
      {text}
    </button>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="result-form"
    >
      <div className="mb-4">
        <SegmentedControl<'WIN' | 'TIE' | 'NO_RESULT'>
          testIDPrefix="result-type"
          value={type}
          onChange={(v) => {
            setType(v);
            if (v !== 'WIN' && !knockout) setWinner(null);
          }}
          options={[
            { value: 'WIN', label: 'Win' },
            { value: 'TIE', label: 'Tie' },
            { value: 'NO_RESULT', label: 'No result' },
          ]}
        />
      </div>

      {needsWinner && (
        <div className="mb-5">
          <span className={LABEL}>{type === 'WIN' ? 'Winner' : 'Goes through'}</span>
          <div className="mt-1 flex flex-wrap gap-3">
            {chip(
              winner === fixture.team_a_entry_id,
              () => setWinner(fixture.team_a_entry_id),
              fixture.team_a_name ?? 'Team A',
              'winner-a',
            )}
            {chip(
              winner === fixture.team_b_entry_id,
              () => setWinner(fixture.team_b_entry_id),
              fixture.team_b_name ?? 'Team B',
              'winner-b',
            )}
          </div>
        </div>
      )}

      {type !== 'NO_RESULT' && (
        <>
          {scoreInputs(
            fixture.team_a_name ?? 'Team A',
            aRuns,
            setARuns,
            aWkts,
            setAWkts,
            aOvers,
            setAOvers,
            'a',
          )}
          {scoreInputs(
            fixture.team_b_name ?? 'Team B',
            bRuns,
            setBRuns,
            bWkts,
            setBWkts,
            bOvers,
            setBOvers,
            'b',
          )}
          <p className="mb-4 font-ui text-micro text-text-tertiary">
            Overs are written like 5.3 (5 overs, 3 balls). If a team was all out, enter the full{' '}
            {overs} overs — that’s how net run rate is worked out.
          </p>
        </>
      )}

      {error && (
        <p
          role="alert"
          data-testid="result-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="result-submit">
        Save result
      </Button>
    </form>
  );
}
