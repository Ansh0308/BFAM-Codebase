import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getExplorerTables: jest.fn(),
    getExplorerRows: jest.fn(),
    insertExplorerRow: jest.fn(),
    updateExplorerRow: jest.fn(),
    deleteExplorerRow: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminDataPage from '../src/app/admin/data/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const COLUMNS = [
  { name: 'code', type: 'varchar(30)', nullable: false, primary: true, masked: false },
  { name: 'discount_value', type: 'decimal(10,2)', nullable: false, primary: false, masked: false },
  { name: 'notes', type: 'text', nullable: true, primary: false, masked: false },
];
const rows = (readOnly = false) => ({
  table: 'promo_codes',
  read_only: readOnly,
  primary_key: 'code',
  columns: COLUMNS,
  rows: [{ code: 'WELCOME', discount_value: '20.00', notes: null }],
  total: 1,
});

// Data Explorer: browse and CRUD any table; secrets hidden, protected tables
// read-only.
describe('Admin Data Explorer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getExplorerTables.mockResolvedValue({
      results: [
        { name: 'promo_codes', rows: 1, read_only: false },
        { name: 'audit_logs', rows: 9, read_only: true },
      ],
    });
  });

  it('asks you to pick a table first', async () => {
    render(<AdminDataPage />);
    expect(await screen.findByTestId('table-promo_codes')).toBeInTheDocument();
    expect(screen.getByTestId('data-empty')).toBeInTheDocument();
  });

  it('shows the rows of the chosen table', async () => {
    api.getExplorerRows.mockResolvedValue(rows());
    render(<AdminDataPage />);
    fireEvent.click(await screen.findByTestId('table-promo_codes'));
    expect(await screen.findByText('WELCOME')).toBeInTheDocument();
    expect(screen.getByText('20.00')).toBeInTheDocument();
  });

  it('read-only tables offer no add / edit / delete', async () => {
    api.getExplorerRows.mockResolvedValue({ ...rows(true), table: 'audit_logs' });
    render(<AdminDataPage />);
    fireEvent.click(await screen.findByTestId('table-audit_logs'));
    await screen.findByText('WELCOME');
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.queryByTestId('add-row')).toBeNull();
    expect(screen.queryByTestId('edit-row-WELCOME')).toBeNull();
  });

  it('edits a row, sending only the changed fields', async () => {
    api.getExplorerRows.mockResolvedValue(rows());
    api.updateExplorerRow.mockResolvedValue({});
    render(<AdminDataPage />);
    fireEvent.click(await screen.findByTestId('table-promo_codes'));
    fireEvent.click(await screen.findByTestId('edit-row-WELCOME'));
    fireEvent.change(await screen.findByTestId('field-discount_value'), {
      target: { value: '25' },
    });
    fireEvent.click(screen.getByTestId('row-submit'));
    await waitFor(() =>
      expect(api.updateExplorerRow).toHaveBeenCalledWith('promo_codes', 'WELCOME', {
        discount_value: '25',
      }),
    );
  });

  it('adds a row', async () => {
    api.getExplorerRows.mockResolvedValue(rows());
    api.insertExplorerRow.mockResolvedValue({});
    render(<AdminDataPage />);
    fireEvent.click(await screen.findByTestId('table-promo_codes'));
    fireEvent.click(await screen.findByTestId('add-row'));
    fireEvent.change(await screen.findByTestId('field-code'), { target: { value: 'NEW10' } });
    fireEvent.change(screen.getByTestId('field-discount_value'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('row-submit'));
    await waitFor(() =>
      expect(api.insertExplorerRow).toHaveBeenCalledWith('promo_codes', {
        code: 'NEW10',
        discount_value: '10',
      }),
    );
  });

  it('deletes a row only after confirmation', async () => {
    api.getExplorerRows.mockResolvedValue(rows());
    api.deleteExplorerRow.mockResolvedValue(undefined);
    render(<AdminDataPage />);
    fireEvent.click(await screen.findByTestId('table-promo_codes'));
    fireEvent.click(await screen.findByTestId('delete-row-WELCOME'));
    expect(api.deleteExplorerRow).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(() =>
      expect(api.deleteExplorerRow).toHaveBeenCalledWith('promo_codes', 'WELCOME'),
    );
  });

  it('shows the server’s reason when a table cannot be loaded', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.getExplorerRows.mockRejectedValue(new BFAMApiError('Unknown table.', 404));
    render(<AdminDataPage />);
    fireEvent.click(await screen.findByTestId('table-promo_codes'));
    expect(await screen.findByTestId('data-error')).toHaveTextContent('Unknown table.');
  });
});
