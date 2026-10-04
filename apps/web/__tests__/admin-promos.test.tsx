import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getPromoCodes: jest.fn(),
    createPromoCode: jest.fn(),
    setPromoCodeActive: jest.fn(),
    updatePromoCode: jest.fn(),
    deletePromoCode: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminPromosPage from '../src/app/admin/promos/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const promo = (code: string, over: Record<string, unknown> = {}) => ({
  promo_code_id: `id-${code}`,
  code,
  discount_type: 'PERCENTAGE',
  discount_value: '20',
  max_discount_amount: '300',
  min_booking_amount: '500',
  usage_limit_total: 100,
  usage_limit_per_player: 1,
  valid_from: null,
  valid_until: null,
  is_active: 1,
  created_at: new Date().toISOString(),
  ...over,
});

describe('Admin Web — Promo codes (PRD §9.1)', () => {
  beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

  it('lists codes with their offer and rules', async () => {
    api.getPromoCodes.mockResolvedValue({ results: [promo('WELCOME20')] });
    render(<AdminPromosPage />);

    expect(await screen.findByText('WELCOME20')).toBeInTheDocument();
    expect(screen.getByText('20% off (up to ₹300)')).toBeInTheDocument();
    expect(screen.getByText('Min booking ₹500')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('labels an expired code', async () => {
    api.getPromoCodes.mockResolvedValue({
      results: [promo('OLD', { valid_until: '2020-01-01T00:00:00.000Z' })],
    });
    render(<AdminPromosPage />);
    expect(await screen.findByText('EXPIRED')).toBeInTheDocument();
  });

  it('switches a code off', async () => {
    api.getPromoCodes.mockResolvedValue({ results: [promo('WELCOME20')] });
    api.setPromoCodeActive.mockResolvedValue({ promo_code_id: 'id-WELCOME20', is_active: false });
    render(<AdminPromosPage />);

    fireEvent.click(await screen.findByTestId('toggle-WELCOME20'));
    await waitFor(() => expect(api.setPromoCodeActive).toHaveBeenCalledWith('id-WELCOME20', false));
    expect(await screen.findByText('OFF')).toBeInTheDocument();
  });

  it('puts the switch back if the server refuses', async () => {
    api.getPromoCodes.mockResolvedValue({ results: [promo('WELCOME20')] });
    api.setPromoCodeActive.mockRejectedValue(new Error('network'));
    render(<AdminPromosPage />);

    fireEvent.click(await screen.findByTestId('toggle-WELCOME20'));
    await waitFor(() => expect(api.setPromoCodeActive).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId('toggle-WELCOME20')).toHaveAttribute('aria-checked', 'true'),
    );
  });

  it('creates a percentage code with its limits', async () => {
    api.getPromoCodes.mockResolvedValue({ results: [] });
    api.createPromoCode.mockResolvedValue({ promo_code_id: 'x', code: 'SUMMER10' });
    render(<AdminPromosPage />);

    fireEvent.click((await screen.findAllByTestId('new-promo'))[0]);
    fireEvent.change(await screen.findByTestId('promo-code'), { target: { value: 'summer10' } });
    fireEvent.change(screen.getByTestId('promo-value'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('promo-max'), { target: { value: '200' } });
    fireEvent.change(screen.getByTestId('promo-min'), { target: { value: '400' } });
    fireEvent.change(screen.getByTestId('promo-total'), { target: { value: '50' } });
    fireEvent.click(screen.getByTestId('promo-submit'));

    await waitFor(() =>
      expect(api.createPromoCode).toHaveBeenCalledWith({
        code: 'SUMMER10',
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        max_discount_amount: 200,
        min_booking_amount: 400,
        usage_limit_total: 50,
        usage_limit_per_player: 1,
      }),
    );
  });

  it('rejects an invalid code before calling the server', async () => {
    api.getPromoCodes.mockResolvedValue({ results: [] });
    render(<AdminPromosPage />);

    fireEvent.click((await screen.findAllByTestId('new-promo'))[0]);
    fireEvent.change(await screen.findByTestId('promo-code'), { target: { value: 'A' } });
    fireEvent.change(screen.getByTestId('promo-value'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('promo-submit'));

    expect(await screen.findByTestId('promo-error')).toHaveTextContent(/3–30/);
    expect(api.createPromoCode).not.toHaveBeenCalled();
  });

  it('refuses a percentage over 100', async () => {
    api.getPromoCodes.mockResolvedValue({ results: [] });
    render(<AdminPromosPage />);

    fireEvent.click((await screen.findAllByTestId('new-promo'))[0]);
    fireEvent.change(await screen.findByTestId('promo-code'), { target: { value: 'BIGDEAL' } });
    fireEvent.change(screen.getByTestId('promo-value'), { target: { value: '150' } });
    fireEvent.click(screen.getByTestId('promo-submit'));

    expect(await screen.findByTestId('promo-error')).toHaveTextContent(/more than 100/);
  });

  it('shows the server’s message for a duplicate code', async () => {
    api.getPromoCodes.mockResolvedValue({ results: [] });
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.createPromoCode.mockRejectedValue(new BFAMApiError('That promo code already exists.', 409));
    render(<AdminPromosPage />);

    fireEvent.click((await screen.findAllByTestId('new-promo'))[0]);
    fireEvent.change(await screen.findByTestId('promo-code'), { target: { value: 'WELCOME20' } });
    fireEvent.change(screen.getByTestId('promo-value'), { target: { value: '20' } });
    fireEvent.click(screen.getByTestId('promo-submit'));

    expect(await screen.findByTestId('promo-error')).toHaveTextContent(
      'That promo code already exists.',
    );
  });
  it('edits a code’s rules', async () => {
    api.getPromoCodes.mockResolvedValue({ results: [promo('WELCOME20')] });
    api.updatePromoCode.mockResolvedValue({});
    render(<AdminPromosPage />);
    fireEvent.click(await screen.findByTestId('edit-WELCOME20'));
    fireEvent.change(await screen.findByTestId('edit-promo-value'), { target: { value: '25' } });
    fireEvent.click(screen.getByTestId('promo-edit-submit'));
    await waitFor(() =>
      expect(api.updatePromoCode).toHaveBeenCalledWith(
        'id-WELCOME20',
        expect.objectContaining({
          discount_value: 25,
          max_discount_amount: 300,
          min_booking_amount: 500,
        }),
      ),
    );
  });

  it('deletes a code after confirmation', async () => {
    api.getPromoCodes.mockResolvedValue({ results: [promo('WELCOME20')] });
    api.deletePromoCode.mockResolvedValue(undefined);
    render(<AdminPromosPage />);
    fireEvent.click(await screen.findByTestId('delete-WELCOME20'));
    expect(api.deletePromoCode).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(() => expect(api.deletePromoCode).toHaveBeenCalledWith('id-WELCOME20'));
  });
});
