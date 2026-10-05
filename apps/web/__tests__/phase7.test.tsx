import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('../src/lib/auth', () => {
  const { BFAMApiError } = jest.requireActual('@bfam/api-client');
  return { useAuth: () => ({ startActingAs: jest.fn() }), BFAMApiError };
});
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyTurfs: jest.fn(),
    getOwnerCustomers: jest.fn(),
    getOwnerCustomer: jest.fn(),
    getMaintenanceTasks: jest.fn(),
    createMaintenanceTask: jest.fn(),
    updateMaintenanceTask: jest.fn(),
    deleteMaintenanceTask: jest.fn(),
    listStaffForTurf: jest.fn(),
    updateStaffPermissions: jest.fn(),
    getStaffActivity: jest.fn(),
    assignStaff: jest.fn(),
    createStaffAccount: jest.fn(),
    reviewStaffVerification: jest.fn(),
    removeStaff: jest.fn(),
    getAllTurfsAdmin: jest.fn(),
    setTurfStatusAdmin: jest.fn(),
    approveTurfAdmin: jest.fn(),
    rejectTurfAdmin: jest.fn(),
    deleteTurfAdmin: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import OwnerCustomersPage from '../src/app/owner/customers/page';
import OwnerMaintenancePage from '../src/app/owner/maintenance/page';
import OwnerStaffPage from '../src/app/owner/staff/page';
import AdminTurfsPage from '../src/app/admin/turfs/page';

const api = apiClient as unknown as Record<string, jest.Mock>;
const TURFS = { results: [{ turf_id: 't1', turf_name: 'Green Park' }] };

beforeEach(() => {
  jest.clearAllMocks();
  api.getMyTurfs.mockResolvedValue(TURFS);
});

// ---- Customers ----------------------------------------------------------------

const customer = (id: string, over: Record<string, unknown> = {}) => ({
  user_id: id,
  name: `Name ${id}`,
  phone_number: `+91${id}`,
  visits: 2,
  cancelled: 0,
  no_shows: 0,
  total_spend: 2000,
  first_booking: '2026-08-01',
  last_booking: '2026-09-20',
  segment: 'OCCASIONAL',
  ...over,
});

describe('Owner Customers', () => {
  const rows = [
    customer('1', { total_spend: 6000, visits: 5, segment: 'REGULAR' }),
    customer('2', { name: null, total_spend: 800, visits: 1, segment: 'NEW', no_shows: 1 }),
    customer('3', { total_spend: 1500, segment: 'LAPSED', last_booking: '2026-05-01' }),
  ];

  it('lists customers with spend, visits and segment, and totals them', async () => {
    api.getOwnerCustomers.mockResolvedValue({ results: rows });
    render(<OwnerCustomersPage />);
    expect(await screen.findByTestId('customer-1')).toHaveTextContent('Name 1');
    expect(screen.getByTestId('customer-1')).toHaveTextContent('₹6,000');
    expect(screen.getByTestId('customer-1')).toHaveTextContent('5 visits');
    expect(screen.getByTestId('customer-1')).toHaveTextContent('Regular');
    // a customer with no name falls back to the phone number
    expect(screen.getByTestId('customer-2')).toHaveTextContent('+912');
    expect(screen.getByTestId('customer-2')).toHaveTextContent('1 no-show');
    expect(screen.getByTestId('customer-totals')).toHaveTextContent('₹8,300');
  });

  it('sorts by highest spend and filters by segment', async () => {
    api.getOwnerCustomers.mockResolvedValue({ results: rows });
    render(<OwnerCustomersPage />);
    await screen.findByTestId('customer-1');
    const order = () =>
      within(screen.getByTestId('customer-list'))
        .getAllByRole('button')
        .map((b) => b.getAttribute('data-testid'));
    expect(order()).toEqual(['customer-1', 'customer-3', 'customer-2']);

    fireEvent.click(screen.getByTestId('segment-LAPSED'));
    expect(order()).toEqual(['customer-3']);
  });

  it('searches by name or phone', async () => {
    api.getOwnerCustomers.mockResolvedValue({ results: rows });
    render(<OwnerCustomersPage />);
    await screen.findByTestId('customer-1');
    fireEvent.change(screen.getByTestId('customer-search'), { target: { value: '+913' } });
    expect(screen.queryByTestId('customer-1')).toBeNull();
    expect(screen.getByTestId('customer-3')).toBeInTheDocument();
  });

  it('opens a customer to show their bookings and a call link', async () => {
    api.getOwnerCustomers.mockResolvedValue({ results: rows });
    api.getOwnerCustomer.mockResolvedValue({
      customer: rows[0],
      bookings: [
        {
          booking_id: 'b1',
          turf_name: 'Green Park',
          booking_date: '2026-09-20',
          start_time: '18:00:00',
          end_time: '19:00:00',
          booking_amount: 1200,
          booking_status: 'COMPLETED',
          payment_mode: 'UPI',
        },
      ],
    });
    render(<OwnerCustomersPage />);
    fireEvent.click(await screen.findByTestId('customer-1'));
    expect(await screen.findByTestId('customer-bookings')).toHaveTextContent('Green Park');
    expect(screen.getByTestId('customer-bookings')).toHaveTextContent('₹1,200');
    expect(screen.getByText('Call +911')).toHaveAttribute('href', 'tel:+911');
  });

  it('says so when there are no customers', async () => {
    api.getOwnerCustomers.mockResolvedValue({ results: [] });
    render(<OwnerCustomersPage />);
    expect(await screen.findByTestId('customers-empty')).toBeInTheDocument();
  });
});

// ---- Maintenance ----------------------------------------------------------------

const task = (id: string, over: Record<string, unknown> = {}) => ({
  task_id: id,
  turf_id: 't1',
  turf_name: 'Green Park',
  title: `Task ${id}`,
  description: null,
  category: 'PITCH',
  priority: 'MEDIUM',
  status: 'OPEN',
  due_date: null,
  cost: null,
  assigned_to: null,
  completed_at: null,
  created_at: '2026-10-01T00:00:00Z',
  overdue: false,
  ...over,
});

describe('Owner Maintenance', () => {
  it('lays tasks out in To do / In progress / Done and flags overdue ones', async () => {
    api.getMaintenanceTasks.mockResolvedValue({
      results: [
        task('a', { overdue: true, due_date: '2026-09-01', priority: 'HIGH' }),
        task('b', { status: 'IN_PROGRESS' }),
        task('c', { status: 'DONE', cost: 1500 }),
      ],
    });
    render(<OwnerMaintenancePage />);
    expect(
      await within(await screen.findByTestId('column-OPEN')).findByText('Task a'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('column-IN_PROGRESS')).getByText('Task b'),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId('column-DONE')).getByText('Task c')).toBeInTheDocument();
    expect(screen.getByTestId('overdue-a')).toHaveTextContent('Overdue');
    expect(screen.getByTestId('maintenance-stats')).toHaveTextContent('₹1,500');
  });

  it('moves a task along with one click', async () => {
    api.getMaintenanceTasks.mockResolvedValue({
      results: [task('a'), task('b', { status: 'IN_PROGRESS' })],
    });
    api.updateMaintenanceTask.mockResolvedValue({});
    render(<OwnerMaintenancePage />);
    fireEvent.click(await screen.findByTestId('advance-a'));
    await waitFor(() =>
      expect(api.updateMaintenanceTask).toHaveBeenCalledWith('a', { status: 'IN_PROGRESS' }),
    );
    fireEvent.click(screen.getByTestId('advance-b'));
    await waitFor(() =>
      expect(api.updateMaintenanceTask).toHaveBeenCalledWith('b', { status: 'DONE' }),
    );
  });

  it('adds a task for the chosen turf', async () => {
    api.getMaintenanceTasks.mockResolvedValue({ results: [] });
    api.createMaintenanceTask.mockResolvedValue(task('n'));
    render(<OwnerMaintenancePage />);
    await screen.findByTestId('maintenance-empty');
    await waitFor(() => expect(screen.getByTestId('new-task')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('new-task'));
    fireEvent.change(await screen.findByTestId('task-title'), {
      target: { value: 'Fix floodlight' },
    });
    fireEvent.change(screen.getByTestId('task-priority'), { target: { value: 'HIGH' } });
    fireEvent.change(screen.getByTestId('task-cost'), { target: { value: '800' } });
    fireEvent.click(screen.getByTestId('task-submit'));
    await waitFor(() =>
      expect(api.createMaintenanceTask).toHaveBeenCalledWith(
        expect.objectContaining({
          turf_id: 't1',
          title: 'Fix floodlight',
          priority: 'HIGH',
          cost: 800,
          category: 'PITCH',
        }),
      ),
    );
  });

  it('needs a title before saving', async () => {
    api.getMaintenanceTasks.mockResolvedValue({ results: [] });
    render(<OwnerMaintenancePage />);
    await screen.findByTestId('maintenance-empty');
    await waitFor(() => expect(screen.getByTestId('new-task')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('new-task'));
    fireEvent.click(await screen.findByTestId('task-submit'));
    expect(await screen.findByTestId('task-error')).toHaveTextContent(/title/i);
    expect(api.createMaintenanceTask).not.toHaveBeenCalled();
  });

  it('deletes only after confirmation', async () => {
    api.getMaintenanceTasks.mockResolvedValue({ results: [task('a')] });
    api.deleteMaintenanceTask.mockResolvedValue(undefined);
    render(<OwnerMaintenancePage />);
    fireEvent.click(await screen.findByTestId('delete-a'));
    expect(api.deleteMaintenanceTask).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(() => expect(api.deleteMaintenanceTask).toHaveBeenCalledWith('a'));
  });
});

// ---- Staff permissions & activity -------------------------------------------------

const staffRow = (over: Record<string, unknown> = {}) => ({
  assignment_id: 'as1',
  turf_id: 't1',
  staff_user_id: 'u1',
  status: 'ACTIVE',
  verification_status: 'APPROVED',
  verification_document_url: null,
  verified_by: null,
  verified_at: null,
  rejection_reason: null,
  created_at: '',
  phone_number: '+919900000001',
  permissions: {},
  ...over,
});

describe('Owner staff permissions', () => {
  it('shows every action as allowed by default', async () => {
    api.listStaffForTurf.mockResolvedValue({ results: [staffRow()] });
    render(<OwnerStaffPage />);
    const box = await screen.findByTestId('permissions-as1');
    for (const k of ['check_in', 'collect_cash', 'score_matches']) {
      expect(within(box).getByTestId(`perm-${k}-as1`)).toBeChecked();
    }
  });

  it('switches one off and saves it', async () => {
    api.listStaffForTurf.mockResolvedValue({ results: [staffRow()] });
    api.updateStaffPermissions.mockResolvedValue({});
    render(<OwnerStaffPage />);
    fireEvent.click(await screen.findByTestId('perm-collect_cash-as1'));
    await waitFor(() =>
      expect(api.updateStaffPermissions).toHaveBeenCalledWith('as1', { collect_cash: false }),
    );
    expect(screen.getByTestId('perm-collect_cash-as1')).not.toBeChecked();
    expect(screen.getByTestId('perm-check_in-as1')).toBeChecked();
  });

  it('puts it back and shows the reason if the save fails', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.listStaffForTurf.mockResolvedValue({
      results: [staffRow({ permissions: { check_in: false } })],
    });
    api.updateStaffPermissions.mockRejectedValue(
      new BFAMApiError('Only this turf’s owner can do that.', 403),
    );
    render(<OwnerStaffPage />);
    const toggle = await screen.findByTestId('perm-check_in-as1');
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(await screen.findByText('Only this turf’s owner can do that.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('perm-check_in-as1')).not.toBeChecked());
  });

  it('offers permissions only once the staff member is verified', async () => {
    api.listStaffForTurf.mockResolvedValue({
      results: [staffRow({ verification_status: 'PENDING' })],
    });
    render(<OwnerStaffPage />);
    await screen.findByTestId('staff-row-as1');
    expect(screen.queryByTestId('permissions-as1')).toBeNull();
  });

  it('shows what the staff member has done', async () => {
    api.listStaffForTurf.mockResolvedValue({ results: [staffRow()] });
    api.getStaffActivity.mockResolvedValue({
      results: [
        {
          log_id: 'l1',
          action: 'STAFF_CASH_COLLECTED',
          resource_id: 'p1',
          details: { amount: 1200 },
          created_at: '2026-10-04T10:00:00Z',
        },
        {
          log_id: 'l2',
          action: 'STAFF_CHECK_IN',
          resource_id: 'm1',
          details: { status: 'CHECKED_IN' },
          created_at: '2026-10-04T09:00:00Z',
        },
      ],
    });
    render(<OwnerStaffPage />);
    const card = await screen.findByTestId('staff-row-as1');
    fireEvent.click(within(card).getByText('Activity'));
    const list = await screen.findByTestId('activity-list');
    expect(list).toHaveTextContent('Collected cash — ₹1,200');
    expect(list).toHaveTextContent('Checked a player in — checked in');
  });

  it('says when there is no activity yet', async () => {
    api.listStaffForTurf.mockResolvedValue({ results: [staffRow()] });
    api.getStaffActivity.mockResolvedValue({ results: [] });
    render(<OwnerStaffPage />);
    fireEvent.click(within(await screen.findByTestId('staff-row-as1')).getByText('Activity'));
    expect(await screen.findByTestId('activity-empty')).toBeInTheDocument();
  });
});

// ---- Turf approval -----------------------------------------------------------------

const turf = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  turf_id: id,
  turf_name: `Turf ${id}`,
  city: 'Rajkot',
  turf_status: status,
  average_rating: null,
  owner_id: 'o1',
  owner_name: 'Ravi',
  owner_phone: '+919900000001',
  rejection_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  ...over,
});

describe('Admin turf approval', () => {
  it('flags turfs waiting for approval and offers approve / reject', async () => {
    api.getAllTurfsAdmin.mockResolvedValue({
      results: [turf('p', 'PENDING_APPROVAL'), turf('a', 'ACTIVE')],
    });
    render(<AdminTurfsPage />);
    expect(await screen.findByTestId('pending-banner')).toHaveTextContent('1 turf is waiting');
    expect(screen.getByText('AWAITING APPROVAL')).toBeInTheDocument();
    expect(screen.getAllByText('Approve')).toHaveLength(1);
    expect(screen.getAllByText('Reject')).toHaveLength(1);
    // a pending turf cannot be "suspended" or "reactivated" around the approval step
    expect(screen.getAllByText('Suspend')).toHaveLength(1);
    expect(screen.queryByText('Reactivate')).toBeNull();
  });

  it('approves a turf', async () => {
    api.getAllTurfsAdmin.mockResolvedValue({ results: [turf('p', 'PENDING_APPROVAL')] });
    api.approveTurfAdmin.mockResolvedValue({});
    render(<AdminTurfsPage />);
    fireEvent.click(await screen.findByText('Approve'));
    await waitFor(() => expect(api.approveTurfAdmin).toHaveBeenCalledWith('p'));
  });

  it('rejects with a reason the owner will read', async () => {
    api.getAllTurfsAdmin.mockResolvedValue({ results: [turf('p', 'PENDING_APPROVAL')] });
    api.rejectTurfAdmin.mockResolvedValue({});
    render(<AdminTurfsPage />);
    fireEvent.click(await screen.findByText('Reject'));
    const dialog = await screen.findByTestId('reject-dialog');
    const reason = within(dialog).getByRole('textbox');
    fireEvent.change(reason, { target: { value: 'Photos are missing' } });
    fireEvent.click(within(dialog).getByTestId('confirm-ok'));
    await waitFor(() =>
      expect(api.rejectTurfAdmin).toHaveBeenCalledWith('p', 'Photos are missing'),
    );
  });

  it('will not send an empty reason', async () => {
    api.getAllTurfsAdmin.mockResolvedValue({ results: [turf('p', 'PENDING_APPROVAL')] });
    render(<AdminTurfsPage />);
    fireEvent.click(await screen.findByText('Reject'));
    fireEvent.click(within(await screen.findByTestId('reject-dialog')).getByTestId('confirm-ok'));
    expect(api.rejectTurfAdmin).not.toHaveBeenCalled();
  });

  it('shows the rejection reason and lets the admin approve it after all', async () => {
    api.getAllTurfsAdmin.mockResolvedValue({
      results: [turf('r', 'REJECTED', { rejection_reason: 'Photos are missing' })],
    });
    render(<AdminTurfsPage />);
    expect(await screen.findByText(/Photos are missing/)).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.queryByText('Reject')).toBeNull();
  });
});
