import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getAllBanners: jest.fn(),
    createBanner: jest.fn(),
    updateBanner: jest.fn(),
    deleteBanner: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminBannersPage from '../src/app/admin/banners/page';

const mockGetAllBanners = apiClient.getAllBanners as jest.Mock;
const mockCreateBanner = apiClient.createBanner as jest.Mock;
const mockUpdateBanner = apiClient.updateBanner as jest.Mock;
const mockDeleteBanner = apiClient.deleteBanner as jest.Mock;

const BANNER = {
  banner_id: 'b1',
  title: 'Summer Offer',
  image_url: 'https://example.com/banner.png',
  link_url: null,
  display_order: 0,
  is_active: true,
  starts_at: null,
  ends_at: null,
  created_by: null,
  created_at: '',
  updated_at: '',
};

// Backlog B-6: Home page carousel admin CMS.
describe('Admin Banners page (backlog B-6)', () => {
  beforeEach(() => {
    mockGetAllBanners.mockReset();
    mockCreateBanner.mockReset();
    mockUpdateBanner.mockReset();
    mockDeleteBanner.mockReset();
    window.confirm = jest.fn(() => true);
  });

  it('lists every banner regardless of active state', async () => {
    mockGetAllBanners.mockResolvedValueOnce({
      results: [BANNER, { ...BANNER, banner_id: 'b2', title: 'Off Season', is_active: false }],
    });

    render(<AdminBannersPage />);

    expect(await screen.findByText('Summer Offer')).toBeInTheDocument();
    expect(await screen.findByText('Off Season')).toBeInTheDocument();
  });

  it('creates a banner from the form', async () => {
    mockGetAllBanners.mockResolvedValue({ results: [] });
    mockCreateBanner.mockResolvedValueOnce({ banner_id: 'new-banner' });

    render(<AdminBannersPage />);
    await waitFor(() => expect(mockGetAllBanners).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Summer Offer'), {
      target: { value: 'Diwali Sale' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('https://…')[0], {
      target: { value: 'https://example.com/diwali.png' },
    });
    fireEvent.click(screen.getByText('Create Banner'));

    await waitFor(() =>
      expect(mockCreateBanner).toHaveBeenCalledWith({
        title: 'Diwali Sale',
        image_url: 'https://example.com/diwali.png',
        link_url: null,
        display_order: 0,
      }),
    );
  });

  it('rejects submitting without a title or image URL', async () => {
    mockGetAllBanners.mockResolvedValue({ results: [] });
    render(<AdminBannersPage />);
    await waitFor(() => expect(mockGetAllBanners).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Create Banner'));

    expect(await screen.findByText(/required/i)).toBeInTheDocument();
    expect(mockCreateBanner).not.toHaveBeenCalled();
  });

  it('toggles a banner active/inactive', async () => {
    mockGetAllBanners.mockResolvedValue({ results: [BANNER] });
    mockUpdateBanner.mockResolvedValueOnce({ ...BANNER, is_active: false });

    render(<AdminBannersPage />);
    fireEvent.click(await screen.findByText('Deactivate'));

    await waitFor(() => expect(mockUpdateBanner).toHaveBeenCalledWith('b1', { is_active: false }));
  });

  it('deletes a banner after confirming', async () => {
    mockGetAllBanners.mockResolvedValue({ results: [BANNER] });
    mockDeleteBanner.mockResolvedValueOnce(undefined);

    render(<AdminBannersPage />);
    fireEvent.click(await screen.findByText('Delete'));

    await waitFor(() => expect(mockDeleteBanner).toHaveBeenCalledWith('b1'));
  });
});
