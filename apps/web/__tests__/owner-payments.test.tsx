import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getOwnerPayments: jest.fn() },
}));

import { apiClient } from '../src/lib/apiClient';
import OwnerPaymentsPage from '../src/app/owner/payments/page';

const getOwnerPayments = apiClient.getOwnerPayments as jest.Mock;

const NOW = new Date().toISOString();
const pay = (id: string, method: string, amount: number, over: Record<string, unknown> = {}) => ({
  payment_id: id,
  payer_id: 'u',
  amount,
  currency: 'INR',
  payment_method: method,
  gateway: 'x',
  gateway_order_id: 'o',
  payment_status: 'SUCCESS',
  initiated_at: NOW,
  completed_at: NOW,
  turf_name: 'Redline Turf Arena',
  ...over,
});

describe('Owner Web — Payments & cash reconciliation (PRD §9.2)', () => {
  beforeEach(() => {
    getOwnerPayments.mockReset();
    localStorage.clear();
  });

  it('lists all payments', async () => {
    getOwnerPayments.mockResolvedValue({
      results: [pay('p1', 'UPI', 900), pay('p2', 'CASH', 300)],
    });
    render(<OwnerPaymentsPage />);

    expect(await screen.findByText('₹900')).toBeInTheDocument();
    expect(screen.getByText('₹300')).toBeInTheDocument();
  });

  it('shows an empty state with no payments', async () => {
    getOwnerPayments.mockResolvedValue({ results: [] });
    render(<OwnerPaymentsPage />);
    expect(await screen.findByText('No payments recorded yet.')).toBeInTheDocument();
  });

  it('groups cash by day and collector', async () => {
    getOwnerPayments.mockResolvedValue({
      results: [
        pay('p1', 'CASH', 300, { collector_phone: '+911111111111', cash_reference: 'R-1' }),
        pay('p2', 'CASH', 200, { collector_phone: '+911111111111' }),
        pay('p3', 'CASH', 500, { collector_phone: '+922222222222' }),
        pay('p4', 'UPI', 900),
      ],
    });
    render(<OwnerPaymentsPage />);

    fireEvent.click(await screen.findByTestId('payments-view-cash'));
    expect(await screen.findByTestId('cash-reconciliation')).toBeInTheDocument();
    expect(screen.getByText('+911111111111')).toBeInTheDocument();
    expect(screen.getByText('+922222222222')).toBeInTheDocument();
    // The UPI payment is not part of the cash view.
    expect(screen.queryByText('₹900')).not.toBeInTheDocument();
    expect(screen.getByText(/ref R-1/)).toBeInTheDocument();
  });

  it('remembers cash ticked as counted in this browser', async () => {
    getOwnerPayments.mockResolvedValue({
      results: [pay('p1', 'CASH', 300, { collector_phone: '+911111111111' })],
    });
    render(<OwnerPaymentsPage />);

    fireEvent.click(await screen.findByTestId('payments-view-cash'));
    fireEvent.click(await screen.findByTestId('counted-p1'));

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('bfam_owner_cash_counted') ?? '[]')).toEqual(['p1']),
    );
    expect(screen.getByText('All counted')).toBeInTheDocument();
  });

  it('shows the cash empty state when nothing was collected in cash', async () => {
    getOwnerPayments.mockResolvedValue({ results: [pay('p1', 'UPI', 900)] });
    render(<OwnerPaymentsPage />);

    fireEvent.click(await screen.findByTestId('payments-view-cash'));
    expect(await screen.findByTestId('cash-empty')).toBeInTheDocument();
  });
});
