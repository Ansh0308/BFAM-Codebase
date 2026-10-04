import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyTurfs: jest.fn(),
    getTurfAvailability: jest.fn(),
    listAvailabilityBlocks: jest.fn(),
    getOwnerBookings: jest.fn(),
    createAvailabilityBlock: jest.fn(),
    removeAvailabilityBlock: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import { todayISO } from '../src/lib/dates';
import OwnerAvailabilityPage from '../src/app/owner/availability/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const slot = (start: string, end: string, status: string) => ({
  start_time: start,
  end_time: end,
  status,
  price_per_hour: 1200,
});

function stub(slots: ReturnType<typeof slot>[], blocks: unknown[] = []) {
  api.getMyTurfs.mockResolvedValue({
    results: [{ turf_id: 't1', turf_name: 'Redline Turf Arena' }],
  });
  api.getTurfAvailability.mockResolvedValue({
    turf_id: 't1',
    date: todayISO(),
    day_type: 'WEEKDAY',
    slots,
  });
  api.listAvailabilityBlocks.mockResolvedValue({ results: blocks });
  api.getOwnerBookings.mockResolvedValue({
    results: [
      {
        booking_id: 'b1',
        start_time: '19:00:00',
        booking_status: 'CONFIRMED',
        customer_name: 'Asha Patel',
      },
    ],
  });
  api.createAvailabilityBlock.mockResolvedValue({ block_id: 'blk' });
  api.removeAvailabilityBlock.mockResolvedValue(undefined);
}

describe('Owner Web — Availability (PRD §30.9)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it('shows each slot as open, booked (with who) or blocked, and counts them', async () => {
    const d = todayISO();
    stub(
      [
        slot('18:00:00', '19:00:00', 'AVAILABLE'),
        slot('19:00:00', '20:00:00', 'BOOKED'),
        slot('20:00:00', '21:00:00', 'BLOCKED'),
      ],
      [
        {
          block_id: 'blk1',
          turf_id: 't1',
          start_datetime: `${d}T20:00:00.000Z`,
          end_datetime: `${d}T21:00:00.000Z`,
          reason: 'MAINTENANCE',
        },
      ],
    );
    render(<OwnerAvailabilityPage />);

    expect(await screen.findByTestId('slot-18:00')).toBeInTheDocument();
    expect(screen.getByText('Asha Patel')).toBeInTheDocument();
    expect(screen.getByText(/tap to open/)).toHaveTextContent('Maintenance');
    // CountUp animates up from 0; data-value holds the settled number.
    expect(screen.getByTestId('stat-open-slots').querySelector('[data-value]')).toHaveAttribute(
      'data-value',
      '1',
    );
    expect(screen.getByTestId('stat-booked').querySelector('[data-value]')).toHaveAttribute(
      'data-value',
      '1',
    );
  });

  it('blocks selected open slots, merging back-to-back ones into a single block', async () => {
    const d = todayISO();
    stub([
      slot('18:00:00', '19:00:00', 'AVAILABLE'),
      slot('19:00:00', '20:00:00', 'AVAILABLE'),
      slot('21:00:00', '22:00:00', 'AVAILABLE'),
    ]);
    render(<OwnerAvailabilityPage />);

    fireEvent.click(await screen.findByTestId('slot-18:00'));
    fireEvent.click(screen.getByTestId('slot-19:00'));
    fireEvent.click(screen.getByTestId('slot-21:00'));
    fireEvent.change(screen.getByTestId('block-reason'), { target: { value: 'HOLIDAY' } });
    fireEvent.click(screen.getByTestId('block-selected'));

    await waitFor(() => expect(api.createAvailabilityBlock).toHaveBeenCalledTimes(2));
    expect(api.createAvailabilityBlock).toHaveBeenNthCalledWith(1, 't1', {
      start_datetime: `${d}T18:00:00.000Z`,
      end_datetime: `${d}T20:00:00.000Z`,
      reason: 'HOLIDAY',
    });
    expect(api.createAvailabilityBlock).toHaveBeenNthCalledWith(2, 't1', {
      start_datetime: `${d}T21:00:00.000Z`,
      end_datetime: `${d}T22:00:00.000Z`,
      reason: 'HOLIDAY',
    });
  });

  it('opens a blocked slot again after confirming', async () => {
    const d = todayISO();
    stub(
      [slot('20:00:00', '21:00:00', 'BLOCKED')],
      [
        {
          block_id: 'blk1',
          turf_id: 't1',
          start_datetime: `${d}T20:00:00.000Z`,
          end_datetime: `${d}T21:00:00.000Z`,
          reason: 'OWNER_BLOCK',
        },
      ],
    );
    render(<OwnerAvailabilityPage />);

    fireEvent.click(await screen.findByTestId('slot-20:00'));
    fireEvent.click(await screen.findByTestId('confirm-ok'));

    await waitFor(() => expect(api.removeAvailabilityBlock).toHaveBeenCalledWith('blk1'));
  });

  it('does not let a booked slot be selected', async () => {
    stub([slot('19:00:00', '20:00:00', 'BOOKED')]);
    render(<OwnerAvailabilityPage />);

    const booked = await screen.findByTestId('slot-19:00');
    expect(booked).toBeDisabled();
  });

  it('shows a prompt when the owner has no turfs', async () => {
    api.getMyTurfs.mockResolvedValue({ results: [] });
    render(<OwnerAvailabilityPage />);
    expect(await screen.findByTestId('availability-no-turfs')).toBeInTheDocument();
  });
});
