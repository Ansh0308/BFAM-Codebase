import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();
const mockStartActingAs = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock('../src/lib/auth', () => {
  const { BFAMApiError } = jest.requireActual('@bfam/api-client');
  return {
    useAuth: () => ({
      user: { user_id: 'admin-1', role: 'ADMIN' },
      startActingAs: mockStartActingAs,
    }),
    BFAMApiError,
  };
});
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getAdminUsers: jest.fn(),
    createManagedUser: jest.fn(),
    updateManagedUser: jest.fn(),
    resetManagedUserPassword: jest.fn(),
    deleteManagedUser: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminUsersPage from '../src/app/admin/users/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const base = {
  email: null,
  city: null,
  bfam_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  last_login_at: null,
};
const USERS = [
  {
    ...base,
    user_id: 'admin-1',
    role: 'ADMIN',
    phone_number: '+911',
    account_status: 'ACTIVE',
    full_name: null,
  },
  {
    ...base,
    user_id: 'own-1',
    role: 'TURF_OWNER',
    phone_number: '+912',
    account_status: 'ACTIVE',
    full_name: null,
  },
  {
    ...base,
    user_id: 'stf-1',
    role: 'TURF_STAFF',
    phone_number: '+913',
    account_status: 'SUSPENDED',
    full_name: null,
  },
  {
    ...base,
    user_id: 'plr-1',
    role: 'PLAYER',
    phone_number: '+914',
    account_status: 'ACTIVE',
    full_name: 'Pat Player',
    bfam_id: 'BF1001',
  },
];

// Admin Users: the only place owner / staff / admin accounts are created, and
// where any account can be edited, suspended, reset or deleted.
describe('Admin Users page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getAdminUsers.mockResolvedValue({ results: USERS });
  });

  it('lists every account with its role and status', async () => {
    render(<AdminUsersPage />);
    expect(await screen.findByText('Pat Player')).toBeInTheDocument();
    expect(screen.getByTestId('user-own-1')).toHaveTextContent('Turf owner');
    expect(screen.getByTestId('user-stf-1')).toHaveTextContent('SUSPENDED');
  });

  it('filters by role', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Pat Player');
    fireEvent.click(screen.getByTestId('user-role-TURF_OWNER'));
    expect(screen.getByTestId('user-own-1')).toBeInTheDocument();
    expect(screen.queryByTestId('user-plr-1')).toBeNull();
  });

  it('creates a turf owner account', async () => {
    api.createManagedUser.mockResolvedValue({ ...USERS[1], role: 'TURF_OWNER' });
    render(<AdminUsersPage />);
    await screen.findByText('Pat Player');

    fireEvent.click(screen.getByTestId('new-user'));
    fireEvent.change(await screen.findByTestId('create-phone'), {
      target: { value: '9876500001' },
    });
    fireEvent.change(screen.getByTestId('create-password'), { target: { value: 'Passw0rd!x' } });
    fireEvent.click(screen.getByTestId('create-submit'));

    await waitFor(() =>
      expect(api.createManagedUser).toHaveBeenCalledWith({
        role: 'TURF_OWNER',
        phone_number: '9876500001',
        password: 'Passw0rd!x',
      }),
    );
  });

  it('refuses a short password without calling the server', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Pat Player');
    fireEvent.click(screen.getByTestId('new-user'));
    fireEvent.change(await screen.findByTestId('create-phone'), {
      target: { value: '9876500001' },
    });
    fireEvent.change(screen.getByTestId('create-password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('create-submit'));

    expect(await screen.findByTestId('user-form-error')).toHaveTextContent(/at least 8/);
    expect(api.createManagedUser).not.toHaveBeenCalled();
  });

  it('reactivates a suspended account', async () => {
    api.updateManagedUser.mockResolvedValue({});
    render(<AdminUsersPage />);
    await screen.findByText('Pat Player');
    fireEvent.click(screen.getByTestId('suspend-stf-1'));
    await waitFor(() =>
      expect(api.updateManagedUser).toHaveBeenCalledWith('stf-1', { account_status: 'ACTIVE' }),
    );
  });

  it('resets a password', async () => {
    api.resetManagedUserPassword.mockResolvedValue(undefined);
    render(<AdminUsersPage />);
    await screen.findByText('Pat Player');
    fireEvent.click(screen.getByTestId('password-own-1'));
    fireEvent.change(await screen.findByTestId('reset-password'), {
      target: { value: 'BrandNew#123' },
    });
    fireEvent.click(screen.getByTestId('reset-submit'));
    await waitFor(() =>
      expect(api.resetManagedUserPassword).toHaveBeenCalledWith('own-1', 'BrandNew#123'),
    );
  });

  it('deletes an account after confirmation', async () => {
    api.deleteManagedUser.mockResolvedValue(undefined);
    render(<AdminUsersPage />);
    await screen.findByText('Pat Player');
    fireEvent.click(screen.getByTestId('delete-stf-1'));
    expect(api.deleteManagedUser).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(() => expect(api.deleteManagedUser).toHaveBeenCalledWith('stf-1'));
  });

  it('does not offer suspend/delete on your own account', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Pat Player');
    expect(screen.queryByTestId('suspend-admin-1')).toBeNull();
    expect(screen.queryByTestId('delete-admin-1')).toBeNull();
  });

  it('"Manage as" opens the owner portal as that owner', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Pat Player');
    fireEvent.click(screen.getByTestId('manage-own-1'));
    expect(mockStartActingAs).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'own-1', role: 'TURF_OWNER' }),
    );
    expect(mockPush).toHaveBeenCalledWith('/owner');
    // players can't be managed as
    expect(screen.queryByTestId('manage-plr-1')).toBeNull();
  });
});
