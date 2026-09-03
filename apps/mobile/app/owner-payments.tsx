import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OwnerPayment } from '@bfam/shared-types';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

// Payments incl. Cash Reconciliation (module 2.12, PRD §8.3/§9.2) — every
// payment against a booking at any turf this owner runs, across UPI,
// gateway, and Cash.
export default function OwnerPaymentsScreen() {
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
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="px-5 flex-1" testID="owner-payments-screen">
        <ScreenHeader title="Payments" />
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            style={{ marginTop: 24 }}
            testID="owner-payments-loading"
          />
        ) : (
          <FlatList
            data={payments}
            keyExtractor={(p) => p.payment_id}
            testID="owner-payments-list"
            ListEmptyComponent={
              <Text
                className="font-ui text-body text-text-tertiary mt-4"
                testID="owner-payments-empty"
              >
                No payments recorded yet.
              </Text>
            }
            renderItem={({ item }) => (
              <View
                className="bg-surface-alt rounded-lg p-4 mb-3"
                testID={`owner-payment-${item.payment_id}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-ui font-bold text-body text-text-primary">
                    {item.turf_name}
                  </Text>
                  <Text
                    className={`font-ui font-bold text-micro uppercase ${
                      item.payment_method === 'CASH' ? 'text-brand-red' : 'text-text-secondary'
                    }`}
                  >
                    {item.payment_method}
                  </Text>
                </View>
                <Text className="font-ui text-micro text-text-tertiary mt-1">
                  ₹{item.amount} · {item.payment_status}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
