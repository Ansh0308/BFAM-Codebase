import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/auth', () => {
  const { BFAMApiError } = jest.requireActual('@bfam/api-client');
  return { BFAMApiError };
});
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyTurfs: jest.fn(),
    listStaffForTurf: jest.fn(),
    assignStaff: jest.fn(),
    createStaffAccount: jest.fn(),
    reviewStaffVerification: jest.fn(),
    removeStaff: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import OwnerStaffPage from '../src/app/owner/staff/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

// Staff can't sign up in the app any more — the owner creates their login.
describe('Owner Staff page: create a staff account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getMyTurfs.mockResolvedValue({ results: [{ turf_id: 't1', turf_name: 'Green Park' }] });
    api.listStaffForTurf.mockResolvedValue({ results: [] });
  });

  it('creates the account for the selected turf', async () => {
    api.createStaffAccount.mockResolvedValue({});
    render(<OwnerStaffPage />);
    await screen.findByTestId('create-staff-card');

    fireEvent.change(screen.getByLabelText('Staff phone number'), {
      target: { value: '9876500001' },
    });
    fireEvent.change(screen.getByLabelText('Temporary password'), {
      target: { value: 'Passw0rd!x' },
    });
    fireEvent.click(screen.getByText('Create Staff Account'));

    await waitFor(() =>
      expect(api.createStaffAccount).toHaveBeenCalledWith('t1', {
        phone_number: '9876500001',
        password: 'Passw0rd!x',
        verified: true,
      }),
    );
    expect(await screen.findByTestId('create-staff-success')).toHaveTextContent('9876500001');
  });

  it('validates before calling the server', async () => {
    render(<OwnerStaffPage />);
    await screen.findByTestId('create-staff-card');
    fireEvent.change(screen.getByLabelText('Staff phone number'), { target: { value: '12' } });
    fireEvent.click(screen.getByText('Create Staff Account'));
    expect(await screen.findByText(/7.15 digits/)).toBeInTheDocument();
    expect(api.createStaffAccount).not.toHaveBeenCalled();
  });

  it('shows the server’s reason (e.g. phone already in use)', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.createStaffAccount.mockRejectedValue(
      new BFAMApiError('That phone number is already in use.', 409),
    );
    render(<OwnerStaffPage />);
    await screen.findByTestId('create-staff-card');
    fireEvent.change(screen.getByLabelText('Staff phone number'), {
      target: { value: '9876500001' },
    });
    fireEvent.change(screen.getByLabelText('Temporary password'), {
      target: { value: 'Passw0rd!x' },
    });
    fireEvent.click(screen.getByText('Create Staff Account'));
    expect(await screen.findByText('That phone number is already in use.')).toBeInTheDocument();
  });
});
