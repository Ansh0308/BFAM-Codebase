'use client';

import React, { useEffect, useState } from 'react';
import type { OwnerPayment } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader, DataTable } from '../../../components/DashboardShell';

// Payments incl. Cash Reconciliation (module 2.12, PRD §8.3/§9.2).
export default function OwnerPaymentsPage() {
  const [payments, setPayments] = useState<OwnerPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getOwnerPayments()
      .then((res) => setPayments(res.results))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="owner-payments-page">
      <PageHeader title="Payments" />
      {loading ? (
        <p className="font-ui text-body text-text-secondary">Loading…</p>
      ) : (
        <DataTable
          rows={payments}
          keyField="payment_id"
          emptyMessage="No payments recorded yet."
          columns={[
            { key: 'turf_name', label: 'Turf' },
            { key: 'payment_method', label: 'Method' },
            { key: 'amount', label: 'Amount', render: (r) => `₹${r.amount}` },
            { key: 'payment_status', label: 'Status' },
          ]}
        />
      )}
    </div>
  );
}
