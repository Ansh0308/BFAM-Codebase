import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/staff',
}));
jest.mock('../src/lib/auth', () => {
  const { BFAMApiError } = jest.requireActual('@bfam/api-client');
  return {
    useAuth: () => ({
      user: { role: 'TURF_STAFF' },
      logout: jest.fn(),
      actingAs: null,
      stopActingAs: jest.fn(),
    }),
    BFAMApiError,
  };
});
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getAdminSettings: jest.fn(),
    updateAdminSettings: jest.fn(),
    getAdminHomeContent: jest.fn(),
    updateHomeContentItem: jest.fn(),
    createHomeContentItem: jest.fn(),
    deleteHomeContentItem: jest.fn(),
    getPromoCodes: jest.fn(),
    getAllTurfsAdmin: jest.fn(),
    getTournaments: jest.fn(),
    lookupStaffCustomers: jest.fn(),
    createStaffWalkIn: jest.fn(),
    raiseStaffTicket: jest.fn(),
    getMyStaffAssignments: jest.fn(),
    getTurfAvailability: jest.fn(),
  },
}));

import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../src/lib/apiClient';
import AdminSettingsPage from '../src/app/admin/settings/page';
import AdminHomeContentPage from '../src/app/admin/home-content/page';
import StaffCustomersPage from '../src/app/staff/customers/page';
import { DashboardShell } from '../src/components/DashboardShell';

const api = apiClient as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---- Platform settings ----------------------------------------------------------

const DEFAULTS = {
  'booking.refund_full_hours': 24,
  'booking.refund_partial_hours': 3,
  'booking.refund_partial_percent': 50,
  'booking.max_advance_days': null,
  'coins.value_in_rupees': 1,
  'coins.review_reward': 20,
  'coins.referral_reward': 100,
  'support.phone': '',
  'support.email': '',
  'legal.terms_url': '',
  'legal.privacy_url': '',
  'app.min_version': '',
  'app.maintenance_enabled': false,
  'app.maintenance_message': '',
};

describe('Admin settings', () => {
  beforeEach(() => {
    api.getAdminSettings.mockResolvedValue({ settings: DEFAULTS, defaults: DEFAULTS });
  });

  it('shows the four cards with the current values', async () => {
    render(<AdminSettingsPage />);
    expect(await screen.findByTestId('card-refunds')).toBeInTheDocument();
    expect(screen.getByTestId('card-coins')).toBeInTheDocument();
    expect(screen.getByTestId('card-support')).toBeInTheDocument();
    expect(screen.getByTestId('card-maintenance')).toBeInTheDocument();
    expect(screen.getByTestId('set-full-hours')).toHaveValue(24);
    expect(screen.getByTestId('set-referral-reward')).toHaveValue(100);
  });

  it('saves only the card that changed', async () => {
    api.updateAdminSettings.mockResolvedValue({
      settings: { ...DEFAULTS, 'booking.refund_full_hours': 48 },
    });
    render(<AdminSettingsPage />);
    const input = await screen.findByTestId('set-full-hours');
    fireEvent.change(input, { target: { value: '48' } });
    fireEvent.click(screen.getByTestId('save-refunds'));
    await waitFor(() => expect(api.updateAdminSettings).toHaveBeenCalledTimes(1));
    expect(api.updateAdminSettings.mock.calls[0][0]).toEqual({ 'booking.refund_full_hours': 48 });
  });

  it('shows the server message when a value is rejected', async () => {
    api.updateAdminSettings.mockRejectedValue(
      new BFAMApiError('The partial refund window must be shorter than the full one.', 422),
    );
    render(<AdminSettingsPage />);
    fireEvent.change(await screen.findByTestId('set-partial-hours'), { target: { value: '30' } });
    fireEvent.click(screen.getByTestId('save-refunds'));
    expect(await screen.findByTestId('card-error')).toHaveTextContent('shorter');
  });

  it('asks before turning maintenance mode on', async () => {
    api.updateAdminSettings.mockResolvedValue({
      settings: { ...DEFAULTS, 'app.maintenance_enabled': true },
    });
    render(<AdminSettingsPage />);
    fireEvent.click(await screen.findByTestId('set-maintenance'));
    expect(await screen.findByTestId('maintenance-dialog')).toBeInTheDocument();
    expect(api.updateAdminSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-ok'));
    await waitFor(() =>
      expect(api.updateAdminSettings).toHaveBeenCalledWith({ 'app.maintenance_enabled': true }),
    );
  });
});

// ---- Home content ---------------------------------------------------------------

const item = (id: string, over: Record<string, unknown> = {}) => ({
  item_id: id,
  kind: 'OFFER',
  ref_id: 'p1',
  ref_label: 'WELCOME50',
  title: null,
  body: null,
  link_url: null,
  display_order: 1,
  is_active: true,
  starts_at: null,
  ends_at: null,
  created_at: '2026-10-01T00:00:00Z',
  ...over,
});

describe('Admin home content', () => {
  it('shows an empty state with no cards', async () => {
    api.getAdminHomeContent.mockResolvedValue({ results: [] });
    render(<AdminHomeContentPage />);
    expect(await screen.findByTestId('home-empty')).toBeInTheDocument();
  });

  it('lists cards and hides one with the toggle', async () => {
    api.getAdminHomeContent.mockResolvedValue({
      results: [
        item('a'),
        item('b', { kind: 'ANNOUNCEMENT', title: 'Diwali offer', display_order: 2 }),
      ],
    });
    api.updateHomeContentItem.mockResolvedValue(item('a', { is_active: false }));
    render(<AdminHomeContentPage />);
    expect(await screen.findByTestId('home-item-a')).toBeInTheDocument();
    expect(screen.getByTestId('home-item-b')).toHaveTextContent('Diwali offer');
    fireEvent.click(screen.getByTestId('home-toggle-a'));
    await waitFor(() =>
      expect(api.updateHomeContentItem).toHaveBeenCalledWith('a', { is_active: false }),
    );
  });

  it('adds an announcement', async () => {
    api.getAdminHomeContent.mockResolvedValue({ results: [] });
    api.createHomeContentItem.mockResolvedValue(item('c', { kind: 'ANNOUNCEMENT' }));
    render(<AdminHomeContentPage />);
    fireEvent.click(await screen.findByTestId('new-home-item'));
    fireEvent.click(await screen.findByTestId('home-kind-ANNOUNCEMENT'));
    fireEvent.change(screen.getByTestId('home-title'), { target: { value: 'Turf closed Sunday' } });
    fireEvent.submit(screen.getByTestId('home-form'));
    await waitFor(() => expect(api.createHomeContentItem).toHaveBeenCalledTimes(1));
    expect(api.createHomeContentItem.mock.calls[0][0]).toMatchObject({
      kind: 'ANNOUNCEMENT',
      title: 'Turf closed Sunday',
    });
  });
});

// ---- Staff customers ------------------------------------------------------------

const customer = (over: Record<string, unknown> = {}) => ({
  user_id: 'u1',
  name: 'Ravi',
  phone_number: '+919800000001',
  bfam_id: 'BF1001',
  bookings_here: 1,
  bookings: [
    {
      booking_id: 'b1',
      turf_id: 't1',
      turf_name: 'Green Park',
      booking_date: '2026-10-01',
      start_time: '18:00:00',
      end_time: '19:00:00',
      booking_amount: 1200,
      booking_status: 'COMPLETED',
      payment_mode: 'CASH',
    },
  ],
  ...over,
});

describe('Staff customers', () => {
  beforeEach(() => {
    api.getMyStaffAssignments.mockResolvedValue({
      results: [
        {
          turf_id: 't1',
          turf_name: 'Green Park',
          status: 'ACTIVE',
          verification_status: 'APPROVED',
        },
      ],
    });
  });

  it('asks for at least three characters before searching', async () => {
    render(<StaffCustomersPage />);
    fireEvent.change(screen.getByTestId('customer-lookup'), { target: { value: '98' } });
    fireEvent.click(screen.getByTestId('lookup-go'));
    expect(await screen.findByTestId('lookup-error')).toBeInTheDocument();
    expect(api.lookupStaffCustomers).not.toHaveBeenCalled();
  });

  it('finds a customer and shows the history at this turf', async () => {
    api.lookupStaffCustomers.mockResolvedValue({ results: [customer()] });
    render(<StaffCustomersPage />);
    fireEvent.change(screen.getByTestId('customer-lookup'), { target: { value: 'BF1001' } });
    fireEvent.click(screen.getByTestId('lookup-go'));
    expect(await screen.findByTestId('customer-u1')).toHaveTextContent('Ravi');
    expect(screen.getByTestId('history-u1')).toHaveTextContent('Green Park');
  });

  it('says so when nobody matches', async () => {
    api.lookupStaffCustomers.mockResolvedValue({ results: [] });
    render(<StaffCustomersPage />);
    fireEvent.change(screen.getByTestId('customer-lookup'), { target: { value: '9811111111' } });
    fireEvent.click(screen.getByTestId('lookup-go'));
    expect(await screen.findByTestId('lookup-empty')).toBeInTheDocument();
  });

  it('disables the complaint button for a customer with no bookings here', async () => {
    api.lookupStaffCustomers.mockResolvedValue({
      results: [customer({ bookings_here: 0, bookings: [] })],
    });
    render(<StaffCustomersPage />);
    fireEvent.change(screen.getByTestId('customer-lookup'), { target: { value: 'BF1001' } });
    fireEvent.click(screen.getByTestId('lookup-go'));
    const btn = await screen.findByTestId('ticket-u1');
    expect(btn).toBeDisabled();
  });

  it('books a walk-in and records the cash', async () => {
    api.lookupStaffCustomers.mockResolvedValue({ results: [customer()] });
    api.getTurfAvailability.mockResolvedValue({
      slots: [
        { start_time: '18:00:00', end_time: '19:00:00', status: 'AVAILABLE', price_per_hour: 1200 },
        { start_time: '19:00:00', end_time: '20:00:00', status: 'BOOKED', price_per_hour: 1200 },
      ],
    });
    api.createStaffWalkIn.mockResolvedValue({ booking: { booking_id: 'nb' }, paid: true });
    render(<StaffCustomersPage />);
    fireEvent.change(screen.getByTestId('customer-lookup'), { target: { value: 'BF1001' } });
    fireEvent.click(screen.getByTestId('lookup-go'));
    fireEvent.click(await screen.findByTestId('book-u1'));
    fireEvent.click(await screen.findByTestId('slot-18:00'));
    expect(screen.getByTestId('slot-19:00')).toBeDisabled();
    expect(screen.getByTestId('walkin-total')).toHaveTextContent('1,200');
    fireEvent.submit(screen.getByTestId('walkin-form'));
    await waitFor(() => expect(api.createStaffWalkIn).toHaveBeenCalledTimes(1));
    expect(api.createStaffWalkIn.mock.calls[0][0]).toMatchObject({
      turf_id: 't1',
      customer_user_id: 'u1',
      start_time: '18:00:00',
      duration_minutes: 60,
      collect_cash: true,
    });
  });

  it('shows the server message when the walk-in is refused', async () => {
    api.lookupStaffCustomers.mockResolvedValue({ results: [customer()] });
    api.getTurfAvailability.mockResolvedValue({
      slots: [
        { start_time: '18:00:00', end_time: '19:00:00', status: 'AVAILABLE', price_per_hour: 1200 },
      ],
    });
    api.createStaffWalkIn.mockRejectedValue(
      new BFAMApiError('Bookings are paused for maintenance.', 503),
    );
    render(<StaffCustomersPage />);
    fireEvent.change(screen.getByTestId('customer-lookup'), { target: { value: 'BF1001' } });
    fireEvent.click(screen.getByTestId('lookup-go'));
    fireEvent.click(await screen.findByTestId('book-u1'));
    fireEvent.click(await screen.findByTestId('slot-18:00'));
    fireEvent.submit(screen.getByTestId('walkin-form'));
    expect(await screen.findByTestId('walkin-error')).toHaveTextContent('maintenance');
  });

  it('logs a complaint for a customer', async () => {
    api.lookupStaffCustomers.mockResolvedValue({ results: [customer()] });
    api.raiseStaffTicket.mockResolvedValue({ ticket_id: 'tk1' });
    render(<StaffCustomersPage />);
    fireEvent.change(screen.getByTestId('customer-lookup'), { target: { value: 'BF1001' } });
    fireEvent.click(screen.getByTestId('lookup-go'));
    fireEvent.click(await screen.findByTestId('ticket-u1'));
    fireEvent.change(await screen.findByTestId('ticket-description'), {
      target: { value: 'Charged twice for the same slot.' },
    });
    fireEvent.submit(screen.getByTestId('ticket-form'));
    await waitFor(() => expect(api.raiseStaffTicket).toHaveBeenCalledTimes(1));
    expect(api.raiseStaffTicket.mock.calls[0][0]).toBe('u1');
    expect(api.raiseStaffTicket.mock.calls[0][1]).toMatchObject({ category: 'BOOKING_ISSUE' });
  });
});

// ---- Responsive shell -----------------------------------------------------------

describe('DashboardShell on a phone', () => {
  const NAV = [
    { href: '/staff', label: 'Desk' },
    { href: '/staff/customers', label: 'Customers' },
    { href: '/staff/matches', label: 'Matches' },
  ];

  it('has a bottom tab bar with every page when there are few', () => {
    render(
      <DashboardShell title="Staff" navItems={NAV}>
        <p>body</p>
      </DashboardShell>,
    );
    const tabs = screen.getByTestId('mobile-tabs');
    expect(tabs).toHaveTextContent('Customers');
    expect(screen.queryByTestId('mobile-more')).not.toBeInTheDocument();
  });

  it('puts the extra pages behind More and opens the menu', async () => {
    const many = [
      ...NAV,
      { href: '/a', label: 'A' },
      { href: '/b', label: 'B' },
      { href: '/c', label: 'Zed' },
    ];
    render(
      <DashboardShell title="Staff" navItems={many}>
        <p>body</p>
      </DashboardShell>,
    );
    expect(screen.getByTestId('mobile-tabs')).not.toHaveTextContent('Zed');
    fireEvent.click(screen.getByTestId('mobile-more'));
    expect(await screen.findByTestId('mobile-drawer')).toHaveTextContent('Matches');
    fireEvent.click(screen.getByLabelText('Close menu'));
    await waitFor(() => expect(screen.queryByTestId('mobile-drawer')).not.toBeInTheDocument());
  });
});
