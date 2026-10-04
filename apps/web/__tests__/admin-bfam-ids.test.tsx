import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getReservedBfamIds: jest.fn(),
    getAllPlayers: jest.fn(),
    lockBfamId: jest.fn(),
    unlockBfamId: jest.fn(),
    assignBfamId: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminBfamIdsPage from '../src/app/admin/bfam-ids/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const reservation = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  reservation_id: `r-${id}`,
  bfam_id: id,
  status,
  locked_by: 'admin',
  locked_at: new Date().toISOString(),
  notes: null,
  assigned_to_user_id: null,
  assigned_at: null,
  ...over,
});

const PLAYER = {
  user_id: 'u1',
  bfam_id: 'BF1001',
  full_name: 'Asha Patel',
  phone_number: '+919876543210',
};

describe('Admin Web — BFAM IDs (PRD §12.59)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.getAllPlayers.mockResolvedValue({ results: [PLAYER] });
  });

  it('lists reservations by status', async () => {
    api.getReservedBfamIds.mockResolvedValue([
      reservation('BF7', 'LOCKED', { notes: 'Captain jersey' }),
      reservation('BF18', 'ASSIGNED', {
        assigned_to_user_id: 'u1',
        assigned_at: new Date().toISOString(),
      }),
    ]);
    render(<AdminBfamIdsPage />);

    expect(await screen.findByTestId('id-BF7')).toHaveTextContent('Reserved');
    expect(screen.getByText('Captain jersey')).toBeInTheDocument();
    expect(screen.getByTestId('id-BF18')).toHaveTextContent('Asha Patel');

    fireEvent.click(screen.getByTestId('ids-filter-ASSIGNED'));
    await waitFor(() => expect(screen.queryByTestId('id-BF7')).not.toBeInTheDocument());
  });

  it('reserves a new ID, upper-casing it', async () => {
    api.getReservedBfamIds.mockResolvedValue([]);
    api.lockBfamId.mockResolvedValue({ bfam_id: 'BF99' });
    render(<AdminBfamIdsPage />);

    fireEvent.change(await screen.findByTestId('lock-id'), { target: { value: 'bf99' } });
    fireEvent.change(screen.getByTestId('lock-notes'), { target: { value: 'VIP' } });
    fireEvent.click(screen.getByTestId('lock-submit'));

    await waitFor(() => expect(api.lockBfamId).toHaveBeenCalledWith('BF99', 'VIP'));
  });

  it('rejects a badly formatted ID without calling the server', async () => {
    api.getReservedBfamIds.mockResolvedValue([]);
    render(<AdminBfamIdsPage />);

    fireEvent.change(await screen.findByTestId('lock-id'), { target: { value: 'ABC' } });
    fireEvent.click(screen.getByTestId('lock-submit'));

    expect(await screen.findByTestId('lock-error')).toHaveTextContent(/BF followed by digits/);
    expect(api.lockBfamId).not.toHaveBeenCalled();
  });

  it('shows the server’s message when an ID is already taken', async () => {
    api.getReservedBfamIds.mockResolvedValue([]);
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.lockBfamId.mockRejectedValue(
      new BFAMApiError('This BFAM ID is already assigned to a user', 409),
    );
    render(<AdminBfamIdsPage />);

    fireEvent.change(await screen.findByTestId('lock-id'), { target: { value: 'BF5' } });
    fireEvent.click(screen.getByTestId('lock-submit'));

    expect(await screen.findByTestId('lock-error')).toHaveTextContent('already assigned');
  });

  it('assigns a reserved ID to a searched-for player', async () => {
    api.getReservedBfamIds.mockResolvedValue([reservation('BF7', 'LOCKED')]);
    api.assignBfamId.mockResolvedValue(undefined);
    render(<AdminBfamIdsPage />);

    fireEvent.click(await screen.findByTestId('assign-BF7'));
    fireEvent.change(await screen.findByTestId('player-search'), { target: { value: 'asha' } });
    fireEvent.click(await screen.findByTestId('pick-u1'));

    await waitFor(() => expect(api.assignBfamId).toHaveBeenCalledWith('BF7', 'u1'));
  });

  it('releases a reserved ID after confirming', async () => {
    api.getReservedBfamIds.mockResolvedValue([reservation('BF7', 'LOCKED')]);
    api.unlockBfamId.mockResolvedValue(undefined);
    render(<AdminBfamIdsPage />);

    fireEvent.click(await screen.findByTestId('unlock-BF7'));
    expect(api.unlockBfamId).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('confirm-ok'));

    await waitFor(() => expect(api.unlockBfamId).toHaveBeenCalledWith('BF7'));
  });

  it('offers no actions on an assigned ID', async () => {
    api.getReservedBfamIds.mockResolvedValue([
      reservation('BF18', 'ASSIGNED', { assigned_to_user_id: 'u1' }),
    ]);
    render(<AdminBfamIdsPage />);

    await screen.findByTestId('id-BF18');
    expect(screen.queryByTestId('assign-BF18')).not.toBeInTheDocument();
    expect(screen.queryByTestId('unlock-BF18')).not.toBeInTheDocument();
  });
});
