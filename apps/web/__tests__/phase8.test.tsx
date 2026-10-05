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
    getMyTurfs: jest.fn(),
    getOwnerOffers: jest.fn(),
    createOwnerOffer: jest.fn(),
    updateOwnerOffer: jest.fn(),
    setOwnerOfferActive: jest.fn(),
    deleteOwnerOffer: jest.fn(),
    getAdminPayments: jest.fn(),
    getAdminRefunds: jest.fn(),
    getAdminRewards: jest.fn(),
    createAdminReward: jest.fn(),
    updateAdminReward: jest.fn(),
    deleteAdminReward: jest.fn(),
    getAdminRedemptions: jest.fn(),
    fulfilAdminRedemption: jest.fn(),
    getAdminMembershipPlans: jest.fn(),
    createAdminMembershipPlan: jest.fn(),
    updateAdminMembershipPlan: jest.fn(),
    deleteAdminMembershipPlan: jest.fn(),
    getTournament: jest.fn(),
    settleTournamentTie: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import { TurfOpenPanel } from '../src/components/TurfOpenPanel';
import OwnerOffersPage from '../src/app/owner/offers/page';
import AdminPaymentsPage from '../src/app/admin/payments/page';
import AdminRewardsPage from '../src/app/admin/rewards/page';
import { TournamentView } from '../src/components/tournaments/TournamentView';

const api = apiClient as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  api.getMyTurfs.mockResolvedValue({ results: [{ turf_id: 't1', turf_name: 'Green Park' }] });
});

// ---- turf open / closed ----------------------------------------------------------

const turf = (over: Record<string, unknown> = {}) => ({
  turf_id: 't1',
  turf_name: 'Green Park',
  city: 'Rajkot',
  closed: false,
  bookings_today: 3,
  ...over,
});

describe('TurfOpenPanel', () => {
  it('shows each turf’s state and how many bookings it has today', async () => {
    const load = jest
      .fn()
      .mockResolvedValue([
        turf(),
        turf({ turf_id: 't2', turf_name: 'Pitch 2', closed: true, bookings_today: 0 }),
      ]);
    render(<TurfOpenPanel load={load} setClosed={jest.fn()} />);
    expect(await screen.findByTestId('turf-state-t1')).toHaveTextContent('Open · 3 bookings today');
    expect(screen.getByTestId('turf-state-t2')).toHaveTextContent(
      'Closed for today · 0 bookings today',
    );
    expect(screen.getByTestId('turf-toggle-t1')).toBeChecked();
    expect(screen.getByTestId('turf-toggle-t2')).not.toBeChecked();
  });

  it('asks before closing, and warns about existing bookings', async () => {
    const setClosed = jest.fn().mockResolvedValue(turf({ closed: true }));
    render(<TurfOpenPanel load={jest.fn().mockResolvedValue([turf()])} setClosed={setClosed} />);
    fireEvent.click(await screen.findByTestId('turf-toggle-t1'));
    const dialog = await screen.findByTestId('close-turf-dialog');
    expect(dialog).toHaveTextContent('3 existing bookings are not cancelled');
    expect(setClosed).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByTestId('confirm-ok'));
    await waitFor(() => expect(setClosed).toHaveBeenCalledWith('t1', true));
    await waitFor(() =>
      expect(screen.getByTestId('turf-state-t1')).toHaveTextContent('Closed for today'),
    );
  });

  it('reopens straight away, with no confirmation', async () => {
    const setClosed = jest.fn().mockResolvedValue(turf({ closed: false }));
    render(
      <TurfOpenPanel
        load={jest.fn().mockResolvedValue([turf({ closed: true })])}
        setClosed={setClosed}
      />,
    );
    fireEvent.click(await screen.findByTestId('turf-toggle-t1'));
    await waitFor(() => expect(setClosed).toHaveBeenCalledWith('t1', false));
    expect(screen.queryByTestId('close-turf-dialog')).toBeNull();
  });

  it('keeps the switch where it was and shows why when it is refused', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    const setClosed = jest
      .fn()
      .mockRejectedValue(
        new BFAMApiError(
          'Your turf owner has not allowed you to open or close the turf for the day.',
          403,
        ),
      );
    render(
      <TurfOpenPanel
        load={jest.fn().mockResolvedValue([turf({ bookings_today: 0 })])}
        setClosed={setClosed}
      />,
    );
    fireEvent.click(await screen.findByTestId('turf-toggle-t1'));
    fireEvent.click(
      within(await screen.findByTestId('close-turf-dialog')).getByTestId('confirm-ok'),
    );
    await waitFor(() => expect(setClosed).toHaveBeenCalled());
    expect(screen.getByTestId('turf-state-t1')).toHaveTextContent('Open');
  });

  it('renders nothing when there are no turfs, or the lookup fails', async () => {
    const { container } = render(
      <TurfOpenPanel load={jest.fn().mockRejectedValue(new Error('x'))} setClosed={jest.fn()} />,
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

// ---- owner offers -------------------------------------------------------------------

const offer = (code: string, over: Record<string, unknown> = {}) => ({
  promo_code_id: `id-${code}`,
  code,
  discount_type: 'PERCENTAGE',
  discount_value: 20,
  max_discount_amount: 300,
  min_booking_amount: 500,
  usage_limit_total: 100,
  usage_limit_per_player: 1,
  valid_from: null,
  valid_until: null,
  is_active: true,
  turf_id: null,
  turf_name: null,
  redeemed: 4,
  created_at: '',
  ...over,
});

describe('Owner offers', () => {
  it('lists offers with their rule, scope and use', async () => {
    api.getOwnerOffers.mockResolvedValue({
      results: [
        offer('WELCOME20'),
        offer('PITCH1', {
          turf_id: 't1',
          turf_name: 'Green Park',
          discount_type: 'FLAT',
          discount_value: 100,
        }),
      ],
    });
    render(<OwnerOffersPage />);
    const card = await screen.findByTestId('offer-WELCOME20');
    expect(card).toHaveTextContent('20% off (up to ₹300)');
    expect(card).toHaveTextContent('All your turfs');
    expect(card).toHaveTextContent('Used 4 of 100');
    expect(card).toHaveTextContent('LIVE');
    expect(screen.getByTestId('offer-PITCH1')).toHaveTextContent('Green Park');
    expect(screen.getByTestId('offer-PITCH1')).toHaveTextContent('₹100 off');
  });

  it('switches an offer off', async () => {
    api.getOwnerOffers.mockResolvedValue({ results: [offer('WELCOME20')] });
    api.setOwnerOfferActive.mockResolvedValue({});
    render(<OwnerOffersPage />);
    fireEvent.click(await screen.findByTestId('offer-toggle-WELCOME20'));
    await waitFor(() =>
      expect(api.setOwnerOfferActive).toHaveBeenCalledWith('id-WELCOME20', false),
    );
    await waitFor(() => expect(screen.getByTestId('offer-WELCOME20')).toHaveTextContent('OFF'));
  });

  it('creates an offer for one of the owner’s turfs', async () => {
    api.getOwnerOffers.mockResolvedValue({ results: [] });
    api.createOwnerOffer.mockResolvedValue(offer('DIWALI'));
    render(<OwnerOffersPage />);
    await screen.findByTestId('offers-empty');
    await waitFor(() => expect(screen.getByTestId('new-offer')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('new-offer'));
    fireEvent.change(await screen.findByTestId('offer-code'), { target: { value: 'diwali' } });
    fireEvent.change(screen.getByTestId('offer-value'), { target: { value: '25' } });
    fireEvent.change(screen.getByTestId('offer-turf'), { target: { value: 't1' } });
    fireEvent.click(screen.getByTestId('offer-submit'));
    await waitFor(() =>
      expect(api.createOwnerOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DIWALI',
          discount_type: 'PERCENTAGE',
          discount_value: 25,
          turf_id: 't1',
        }),
      ),
    );
  });

  it('validates the code and the discount before saving', async () => {
    api.getOwnerOffers.mockResolvedValue({ results: [] });
    render(<OwnerOffersPage />);
    await screen.findByTestId('offers-empty');
    await waitFor(() => expect(screen.getByTestId('new-offer')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('new-offer'));
    fireEvent.change(await screen.findByTestId('offer-code'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('offer-submit'));
    expect(await screen.findByTestId('offer-error')).toHaveTextContent(/3–30 letters/);

    fireEvent.change(screen.getByTestId('offer-code'), { target: { value: 'GOOD10' } });
    fireEvent.change(screen.getByTestId('offer-value'), { target: { value: '150' } });
    fireEvent.click(screen.getByTestId('offer-submit'));
    expect(await screen.findByTestId('offer-error')).toHaveTextContent(/more than 100/);
    expect(api.createOwnerOffer).not.toHaveBeenCalled();
  });

  it('shows the server’s reason, e.g. a code already taken', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.getOwnerOffers.mockResolvedValue({ results: [] });
    api.createOwnerOffer.mockRejectedValue(
      new BFAMApiError('That code is already in use. Choose another.', 409),
    );
    render(<OwnerOffersPage />);
    await screen.findByTestId('offers-empty');
    await waitFor(() => expect(screen.getByTestId('new-offer')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('new-offer'));
    fireEvent.change(await screen.findByTestId('offer-code'), { target: { value: 'TAKEN1' } });
    fireEvent.change(screen.getByTestId('offer-value'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('offer-submit'));
    expect(await screen.findByTestId('offer-error')).toHaveTextContent('already in use');
  });

  it('deletes only after confirmation', async () => {
    api.getOwnerOffers.mockResolvedValue({ results: [offer('WELCOME20')] });
    api.deleteOwnerOffer.mockResolvedValue(undefined);
    render(<OwnerOffersPage />);
    fireEvent.click(await screen.findByTestId('delete-offer-WELCOME20'));
    expect(api.deleteOwnerOffer).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(() => expect(api.deleteOwnerOffer).toHaveBeenCalledWith('id-WELCOME20'));
  });
});

// ---- admin payments ------------------------------------------------------------------

const payment = (id: string, over: Record<string, unknown> = {}) => ({
  payment_id: id,
  amount: 500,
  payment_method: 'UPI',
  payment_status: 'SUCCESS',
  kind: 'BOOKING',
  reference: 'rzp_1',
  payer_phone: '+911',
  payer_name: 'Asha',
  collected_by_phone: null,
  context: 'Green Park',
  refunded: 0,
  initiated_at: '2026-10-03T10:00:00Z',
  completed_at: null,
  ...over,
});
const summary = {
  collected: 1700,
  pending: 250,
  failed: 400,
  refunded: 300,
  count: 4,
  by_method: [
    { method: 'CASH', payments: 1, amount: 1200 },
    { method: 'UPI', payments: 2, amount: 500 },
  ],
};

describe('Admin payments', () => {
  it('shows totals by status and by method, and each payment’s purpose', async () => {
    api.getAdminPayments.mockResolvedValue({
      results: [
        payment('p1', { kind: 'TOURNAMENT_ENTRY', context: 'Diwali Cup' }),
        payment('p2', { payment_method: 'CASH', refunded: 300, payer_name: null }),
      ],
      summary,
    });
    render(<AdminPaymentsPage />);
    expect(await screen.findByTestId('payment-p1')).toHaveTextContent('Diwali Cup');
    expect(screen.getByTestId('payment-p1')).toHaveTextContent('Tournament entry');
    expect(screen.getByTestId('payment-p2')).toHaveTextContent('₹300');
    expect(screen.getByTestId('tile-collected').querySelector('[data-value]')).toHaveAttribute(
      'data-value',
      '1700',
    );
    expect(screen.getByTestId('tile-refunded').querySelector('[data-value]')).toHaveAttribute(
      'data-value',
      '300',
    );
    expect(screen.getByTestId('by-method')).toHaveTextContent('Cash: 1 (₹1,200)');
  });

  it('asks the server for the chosen filters', async () => {
    api.getAdminPayments.mockResolvedValue({ results: [], summary });
    render(<AdminPaymentsPage />);
    await screen.findByTestId('payments-empty');
    fireEvent.change(screen.getByTestId('pay-status'), { target: { value: 'FAILED' } });
    await waitFor(() =>
      expect(api.getAdminPayments).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'FAILED' }),
      ),
    );
    fireEvent.change(screen.getByTestId('pay-kind'), { target: { value: 'TOURNAMENT_ENTRY' } });
    await waitFor(() =>
      expect(api.getAdminPayments).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'FAILED', kind: 'TOURNAMENT_ENTRY' }),
      ),
    );
    fireEvent.click(screen.getByTestId('pay-range-7'));
    await waitFor(() => {
      const last = api.getAdminPayments.mock.calls.at(-1)![0];
      expect((new Date(last.to).getTime() - new Date(last.from).getTime()) / 86_400_000).toBe(6);
    });
  });

  it('switches to refunds', async () => {
    api.getAdminPayments.mockResolvedValue({ results: [payment('p1')], summary });
    api.getAdminRefunds.mockResolvedValue({
      results: [
        {
          refund_id: 'r1',
          payment_id: 'p1',
          refund_amount: 300,
          reason: 'Cancelled by player',
          refund_status: 'COMPLETED',
          payment_amount: 1200,
          payment_method: 'UPI',
          payer_phone: '+912',
          payer_name: 'Dev',
          created_at: '2026-10-03T10:00:00Z',
          completed_at: null,
        },
      ],
    });
    render(<AdminPaymentsPage />);
    await screen.findByTestId('payment-p1');
    fireEvent.click(screen.getByTestId('pay-view-refunds'));
    const row = await screen.findByTestId('refund-r1');
    expect(row).toHaveTextContent('Cancelled by player');
    expect(row).toHaveTextContent('₹300');
    expect(row).toHaveTextContent('of ₹1,200');
  });

  it('shows the server’s message when the range is refused', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.getAdminPayments.mockRejectedValue(
      new BFAMApiError('Choose a range of at most 366 days.', 400),
    );
    render(<AdminPaymentsPage />);
    expect(await screen.findByTestId('payments-error')).toHaveTextContent('366');
  });
});

// ---- admin rewards & membership ---------------------------------------------------------

const reward = (id: string, over: Record<string, unknown> = {}) => ({
  reward_id: id,
  name: `Reward ${id}`,
  description: null,
  coin_cost: 500,
  is_active: true,
  redemptions: 2,
  created_at: '',
  ...over,
});
const plan = (id: string, over: Record<string, unknown> = {}) => ({
  plan_id: id,
  name: `Plan ${id}`,
  duration_days: 30,
  coin_cost: 1500,
  discount_percent: 10,
  is_active: true,
  active_members: 3,
  total_members: 5,
  created_at: '',
  ...over,
});

describe('Admin rewards & membership', () => {
  beforeEach(() => {
    api.getAdminRewards.mockResolvedValue({ results: [reward('r1')] });
    api.getAdminRedemptions.mockResolvedValue({
      results: [
        {
          redemption_id: 'x1',
          status: 'PENDING',
          coins_spent: 500,
          created_at: '2026-10-01T00:00:00Z',
          reward_name: 'Reward r1',
          player_name: 'Asha',
          bfam_id: 'BF1',
          player_phone: '+911',
        },
      ],
    });
    api.getAdminMembershipPlans.mockResolvedValue({ results: [plan('m1')] });
  });

  it('lists rewards with their cost and how often they were redeemed', async () => {
    render(<AdminRewardsPage />);
    const row = await screen.findByTestId('reward-r1');
    expect(row).toHaveTextContent('Reward r1');
    expect(row).toHaveTextContent('2 redeemed');
    expect(row).toHaveTextContent('500 coins');
  });

  it('adds a reward', async () => {
    api.createAdminReward.mockResolvedValue({});
    render(<AdminRewardsPage />);
    fireEvent.click(await screen.findByTestId('new-reward'));
    fireEvent.change(await screen.findByTestId('reward-name'), {
      target: { value: 'Water bottle' },
    });
    fireEvent.change(screen.getByTestId('reward-cost'), { target: { value: '200' } });
    fireEvent.click(screen.getByTestId('reward-submit'));
    await waitFor(() =>
      expect(api.createAdminReward).toHaveBeenCalledWith({
        name: 'Water bottle',
        description: null,
        coin_cost: 200,
      }),
    );
  });

  it('validates a reward before saving', async () => {
    render(<AdminRewardsPage />);
    fireEvent.click(await screen.findByTestId('new-reward'));
    fireEvent.click(await screen.findByTestId('reward-submit'));
    expect(await screen.findByTestId('reward-error')).toHaveTextContent(/name/i);
    expect(api.createAdminReward).not.toHaveBeenCalled();
  });

  it('switches a reward off and edits its cost', async () => {
    api.updateAdminReward.mockResolvedValue({});
    render(<AdminRewardsPage />);
    fireEvent.click(await screen.findByTestId('reward-toggle-r1'));
    await waitFor(() =>
      expect(api.updateAdminReward).toHaveBeenCalledWith('r1', { is_active: false }),
    );

    fireEvent.click(screen.getByTestId('edit-reward-r1'));
    fireEvent.change(await screen.findByTestId('reward-cost'), { target: { value: '650' } });
    fireEvent.click(screen.getByTestId('reward-submit'));
    await waitFor(() =>
      expect(api.updateAdminReward).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ coin_cost: 650 }),
      ),
    );
  });

  it('shows the server’s reason when a redeemed reward cannot be deleted', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.deleteAdminReward.mockRejectedValue(
      new BFAMApiError(
        'Players have already redeemed this reward. Switch it off instead of deleting it.',
        409,
      ),
    );
    render(<AdminRewardsPage />);
    fireEvent.click(await screen.findByTestId('delete-reward-r1'));
    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(() => expect(api.deleteAdminReward).toHaveBeenCalledWith('r1'));
  });

  it('hands a redemption over', async () => {
    api.fulfilAdminRedemption.mockResolvedValue(undefined);
    render(<AdminRewardsPage />);
    fireEvent.click(await screen.findByTestId('rewards-tab-redemptions'));
    const row = await screen.findByTestId('redemption-x1');
    expect(row).toHaveTextContent('Asha');
    fireEvent.click(within(row).getByTestId('fulfil-x1'));
    await waitFor(() => expect(api.fulfilAdminRedemption).toHaveBeenCalledWith('x1'));
  });

  it('manages membership plans', async () => {
    api.createAdminMembershipPlan.mockResolvedValue({});
    render(<AdminRewardsPage />);
    fireEvent.click(await screen.findByTestId('rewards-tab-plans'));
    expect(await screen.findByTestId('plan-m1')).toHaveTextContent('3 active members');

    fireEvent.click(screen.getByTestId('new-plan'));
    fireEvent.change(await screen.findByTestId('plan-name'), { target: { value: 'Season Pass' } });
    fireEvent.change(screen.getByTestId('plan-days'), { target: { value: '90' } });
    fireEvent.change(screen.getByTestId('plan-cost'), { target: { value: '3500' } });
    fireEvent.change(screen.getByTestId('plan-discount'), { target: { value: '15' } });
    fireEvent.click(screen.getByTestId('plan-submit'));
    await waitFor(() =>
      expect(api.createAdminMembershipPlan).toHaveBeenCalledWith({
        name: 'Season Pass',
        duration_days: 90,
        coin_cost: 3500,
        discount_percent: 15,
      }),
    );
  });

  it('refuses a discount over 100 before calling the server', async () => {
    render(<AdminRewardsPage />);
    fireEvent.click(await screen.findByTestId('rewards-tab-plans'));
    fireEvent.click(await screen.findByTestId('new-plan'));
    fireEvent.change(await screen.findByTestId('plan-name'), { target: { value: 'Bad' } });
    fireEvent.change(screen.getByTestId('plan-cost'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('plan-discount'), { target: { value: '150' } });
    // (a browser would also block this natively because of max=100; submit directly)
    fireEvent.submit(screen.getByTestId('plan-form'));
    expect(await screen.findByTestId('plan-error')).toHaveTextContent(/between 0 and 100/);
    expect(api.createAdminMembershipPlan).not.toHaveBeenCalled();
  });
});

// ---- knockout tie ------------------------------------------------------------------------

describe('Knockout tie', () => {
  const fixture = (over: Record<string, unknown> = {}) => ({
    fixture_id: 'f9',
    tournament_id: 't1',
    stage: 'KNOCKOUT',
    stage_label: 'Semi-final',
    round_number: 1,
    match_number: 5,
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
    team_a_runs: 50,
    team_a_wickets: 2,
    team_a_overs: 6,
    team_b_runs: 50,
    team_b_wickets: 3,
    team_b_overs: 6,
    next_match_number: 7,
    match_id: 'm1',
    match_status: 'COMPLETED',
    ...over,
  });
  const detail = (over: Record<string, unknown> = {}) => ({
    tournament: {
      tournament_id: 't1',
      name: 'Diwali Cup',
      description: null,
      format: 'KNOCKOUT',
      organiser_id: 'o',
      turf_id: 'turf',
      turf_name: 'Green Park',
      overs_per_innings: 6,
      entry_fee: '0.00',
      min_teams: 2,
      max_teams: 8,
      double_round: 0,
      start_date: null,
      registration_deadline: null,
      status: 'IN_PROGRESS',
      champion_entry_id: null,
      champion_name: null,
      created_at: '',
    },
    can_manage: true,
    is_host: true,
    can_start_knockout: false,
    entries: [
      {
        entry_id: 'ea',
        tournament_id: 't1',
        team_id: 'a',
        team_name: 'Alpha',
        status: 'APPROVED',
        payment_status: 'NOT_REQUIRED',
        registered_by_phone: null,
        seed: null,
      },
      {
        entry_id: 'eb',
        tournament_id: 't1',
        team_id: 'b',
        team_name: 'Bravo',
        status: 'APPROVED',
        payment_status: 'NOT_REQUIRED',
        registered_by_phone: null,
        seed: null,
      },
    ],
    fixtures: [fixture()],
    table: [],
    ...over,
  });
  const view = () =>
    render(<TournamentView tournamentId="t1" backHref="/b" scoringBase="/owner/scoring" />);

  it('asks the host who goes through, and records the pick', async () => {
    api.getTournament.mockResolvedValue(detail());
    api.settleTournamentTie.mockResolvedValue(undefined);
    view();
    const tie = await screen.findByTestId('tie-5');
    expect(tie).toHaveTextContent('Tied — choose who goes through');
    fireEvent.click(within(tie).getByTestId('settle-5-b'));
    await waitFor(() => expect(api.settleTournamentTie).toHaveBeenCalledWith('f9', 'eb'));
  });

  it('replaces manual entry while a tie is waiting', async () => {
    api.getTournament.mockResolvedValue(detail());
    view();
    await screen.findByTestId('tie-5');
    expect(screen.queryByTestId('enter-result-5')).toBeNull();
    expect(screen.queryByTestId('score-5')).toBeNull();
  });

  it('shows nothing of the sort once the fixture is settled', async () => {
    api.getTournament.mockResolvedValue(
      detail({
        fixtures: [
          fixture({
            status: 'COMPLETED',
            result_type: 'TIE',
            winner_entry_id: 'eb',
            winner_name: 'Bravo',
          }),
        ],
      }),
    );
    view();
    expect(await screen.findByTestId('result-5')).toHaveTextContent('Tied · Bravo advance');
    expect(screen.queryByTestId('tie-5')).toBeNull();
  });
});
