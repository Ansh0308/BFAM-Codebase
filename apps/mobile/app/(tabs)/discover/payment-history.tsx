import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Payment } from '@bfam/shared-types';
import { apiClient } from '../../../src/lib/apiClient';
import { colors } from '../../../src/theme/tokens';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'text-text-secondary',
  SUCCESS: 'text-brand-red',
  FAILED: 'text-text-tertiary',
  REFUNDED: 'text-text-tertiary',
};

// Payment History (module 2.4, requirement 6): mode, status, collected_by
// (for cash), and reference for every transaction.
export default function PaymentHistoryScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getMyPaymentHistory()
      .then((res) => setPayments(res.results))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.brandRed} testID="payment-history-loading" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-alt px-6" edges={['bottom']}>
      <View testID="payment-history-screen" className="flex-1 pt-4">
        {payments.length === 0 ? (
          <Text className="text-text-secondary text-body text-center mt-6">No payments yet.</Text>
        ) : (
          <FlatList
            data={payments}
            keyExtractor={(item) => item.payment_id}
            renderItem={({ item }) => (
              <View
                className="bg-surface rounded-md border border-border-subtle p-4 mb-3"
                testID={`payment-row-${item.payment_id}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-ui font-bold text-text-primary text-button">
                    {item.payment_method.replace('_', ' ')}
                  </Text>
                  <Text
                    className={`text-micro uppercase ${STATUS_STYLES[item.payment_status] ?? 'text-text-secondary'}`}
                  >
                    {item.payment_status}
                  </Text>
                </View>
                <Text className="text-text-secondary text-body mt-1">₹{item.amount}</Text>
                {item.collected_by && (
                  <Text className="text-text-tertiary text-micro mt-1">
                    Collected by {item.collected_by}
                  </Text>
                )}
                {item.cash_reference && (
                  <Text className="text-text-tertiary text-micro mt-1">
                    Ref: {item.cash_reference}
                  </Text>
                )}
                {item.gateway_payment_id && (
                  <Text className="text-text-tertiary text-micro mt-1">
                    Ref: {item.gateway_payment_id}
                  </Text>
                )}
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
