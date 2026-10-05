import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { AnalyticsResult } from '@bfam/shared-types';

import { AnalyticsDashboard } from '../src/components/analytics/AnalyticsDashboard';
import { AreaChart, BarChart } from '../src/components/ui/charts';

const summary = (over: Record<string, number> = {}) => ({
  bookings: 20,
  cancelled: 2,
  cancellation_rate: 10,
  revenue: 24000,
  collected: 18000,
  outstanding: 6000,
  avg_booking_value: 1200,
  unique_customers: 12,
  new_customers: 4,
  occupancy_pct: 35,
  no_shows: 3,
  ...over,
});

function result(over: Partial<AnalyticsResult> = {}): AnalyticsResult {
  return {
    range: { from: '2026-09-05', to: '2026-10-04', days: 3 },
    previous_range: { from: '2026-08-06', to: '2026-09-04' },
    summary: summary(),
    previous: summary({ revenue: 20000, bookings: 25, cancellation_rate: 5, no_shows: 3 }),
    daily: [
      { date: '2026-10-02', bookings: 2, revenue: 2400 },
      { date: '2026-10-03', bookings: 5, revenue: 6000 },
      { date: '2026-10-04', bookings: 1, revenue: 1200 },
    ],
    peak_hours: Array.from({ length: 24 }, (_, hour) => ({ hour, bookings: hour === 20 ? 7 : 0 })),
    by_weekday: Array.from({ length: 7 }, (_, dow) => ({
      dow,
      bookings: dow === 6 ? 9 : 1,
      revenue: 0,
    })),
    by_turf: [
      { turf_id: 't1', turf_name: 'Green Park', bookings: 20, revenue: 24000, occupancy_pct: 35 },
    ],
    payment_modes: [{ mode: 'SPLIT_PAYMENT', bookings: 8 }],
    ...over,
  };
}

describe('AnalyticsDashboard', () => {
  it('shows headline figures with change against the previous period', async () => {
    const load = jest.fn().mockResolvedValue(result());
    render(<AnalyticsDashboard title="Analytics" subtitle="s" load={load} />);

    const revenue = await screen.findByTestId('kpi-revenue');
    expect(revenue.querySelector('[data-value]')).toHaveAttribute('data-value', '24000');
    // 24000 vs 20000 = +20%, good
    expect(revenue.querySelector('[data-testid=delta]')).toHaveAttribute('data-direction', 'up');
    expect(revenue).toHaveTextContent('20.0%');

    // bookings fell 25 -> 20, shown as down
    expect(screen.getByTestId('kpi-bookings').querySelector('[data-testid=delta]')).toHaveAttribute(
      'data-direction',
      'down',
    );

    // cancellations went up 5% -> 10%: a rise is bad, but still direction "up"
    const cancel = screen.getByTestId('kpi-cancellation-rate').querySelector('[data-testid=delta]');
    expect(cancel).toHaveAttribute('data-direction', 'up');
    expect(cancel?.className).toMatch(/danger/);
  });

  it('asks for the last 30 days by default and refetches when the range changes', async () => {
    const load = jest.fn().mockResolvedValue(result());
    render(<AnalyticsDashboard title="Analytics" subtitle="s" load={load} />);
    await screen.findByTestId('kpi-revenue');

    const first = load.mock.calls[0][0];
    const days = (new Date(first.to).getTime() - new Date(first.from).getTime()) / 86_400_000 + 1;
    expect(Math.round(days)).toBe(30);

    fireEvent.click(screen.getByTestId('range-7'));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    const second = load.mock.calls[1][0];
    expect(
      Math.round((new Date(second.to).getTime() - new Date(second.from).getTime()) / 86_400_000) +
        1,
    ).toBe(7);
  });

  it('highlights the peak hour and busiest day', async () => {
    render(
      <AnalyticsDashboard
        title="Analytics"
        subtitle="s"
        load={jest.fn().mockResolvedValue(result())}
      />,
    );
    expect(await screen.findByTestId('chart-hours')).toHaveAttribute('data-peak', '8p');
    expect(screen.getByTestId('chart-weekday')).toHaveAttribute('data-peak', 'Sat');
  });

  it('switches the trend between revenue and bookings', async () => {
    render(
      <AnalyticsDashboard
        title="Analytics"
        subtitle="s"
        load={jest.fn().mockResolvedValue(result())}
      />,
    );
    const trend = await screen.findByTestId('chart-trend');
    expect(trend).toHaveAttribute('data-total', '9600');
    fireEvent.click(screen.getByTestId('metric-bookings'));
    expect(screen.getByTestId('chart-trend')).toHaveAttribute('data-total', '8');
  });

  it('ranks turfs and names the payment modes', async () => {
    render(
      <AnalyticsDashboard
        title="Analytics"
        subtitle="s"
        load={jest.fn().mockResolvedValue(result())}
      />,
    );
    expect(await screen.findByText('Green Park')).toBeInTheDocument();
    expect(screen.getByText('Split payment')).toBeInTheDocument();
  });

  it('shows player growth only for the platform view', async () => {
    const growth = [{ date: '2026-10-04', new_players: 3 }];
    const { unmount } = render(
      <AnalyticsDashboard
        title="A"
        subtitle="s"
        platform
        load={jest.fn().mockResolvedValue(result({ growth }))}
      />,
    );
    expect(await screen.findByTestId('panel-growth')).toBeInTheDocument();
    unmount();

    render(
      <AnalyticsDashboard
        title="A"
        subtitle="s"
        load={jest.fn().mockResolvedValue(result({ growth }))}
      />,
    );
    await screen.findByTestId('kpi-revenue');
    expect(screen.queryByTestId('panel-growth')).toBeNull();
  });

  it('offers a turf filter for owners with more than one turf', async () => {
    const load = jest.fn().mockResolvedValue(result());
    render(
      <AnalyticsDashboard
        title="A"
        subtitle="s"
        load={load}
        turfs={[
          { turf_id: 't1', turf_name: 'Green Park' },
          { turf_id: 't2', turf_name: 'Pitch 2' },
        ]}
      />,
    );
    await screen.findByTestId('kpi-revenue');
    fireEvent.change(screen.getByTestId('analytics-turf'), { target: { value: 't2' } });
    await waitFor(() =>
      expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ turf_id: 't2' })),
    );
  });

  it('says so when there are no bookings', async () => {
    render(
      <AnalyticsDashboard
        title="A"
        subtitle="s"
        load={jest
          .fn()
          .mockResolvedValue(result({ summary: summary({ bookings: 0, revenue: 0 }) }))}
      />,
    );
    expect(await screen.findByTestId('analytics-empty')).toBeInTheDocument();
  });

  it('shows the server’s message when loading fails', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    render(
      <AnalyticsDashboard
        title="A"
        subtitle="s"
        load={jest
          .fn()
          .mockRejectedValue(new BFAMApiError('Choose a range of at most 366 days.', 400))}
      />,
    );
    expect(await screen.findByTestId('analytics-error')).toHaveTextContent(/366 days/);
  });
});

describe('charts', () => {
  it('AreaChart sums its points and handles an empty series', () => {
    const { rerender } = render(
      <AreaChart
        points={[
          { label: 'a', value: 2 },
          { label: 'b', value: 3 },
        ]}
        ariaLabel="x"
        testID="c"
      />,
    );
    expect(screen.getByTestId('c')).toHaveAttribute('data-total', '5');
    rerender(<AreaChart points={[]} ariaLabel="x" testID="c" />);
    expect(screen.getByTestId('c')).toHaveAttribute('data-total', '0');
  });

  it('BarChart marks the tallest bar as the peak', () => {
    render(
      <BarChart
        bars={[
          { label: 'a', value: 1 },
          { label: 'b', value: 9 },
          { label: 'c', value: 4 },
        ]}
        ariaLabel="x"
        testID="b"
      />,
    );
    expect(screen.getByTestId('b')).toHaveAttribute('data-peak', 'b');
  });
});
