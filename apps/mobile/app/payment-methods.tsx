import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../src/components/ScreenHeader';

// List/manage-only screen — adding a payment method goes through Razorpay,
// which is Module 2.4, not this one. There's also no saved-payment-methods
// table in the DB doc (payments.payment_method is per-transaction, not a
// stored/reusable method), so this renders an empty state only.
export default function PaymentMethods() {
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-5" testID="payment-methods-screen">
        <ScreenHeader title="Payment Methods" />

        <View className="items-center mt-16 px-6">
          <View
            className="rounded-full bg-surface-alt items-center justify-center mb-4"
            style={{ width: 64, height: 64 }}
          >
            <Feather name="credit-card" size={28} color="#D80000" />
          </View>
          <Text className="font-display text-card-title uppercase text-ink-black text-center">
            No Payment Methods Yet
          </Text>
          <Text className="font-ui text-body text-text-tertiary text-center mt-2">
            You'll be able to add and manage UPI and card details here once online payments go live.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
