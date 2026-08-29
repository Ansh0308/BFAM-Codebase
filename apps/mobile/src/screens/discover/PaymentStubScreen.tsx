import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { DiscoverStackParamList } from '../../navigation/types';

type Props = StackScreenProps<DiscoverStackParamList, 'PaymentStub'>;

// Deliberate stub — module 2.4 (Payments) owns the real UPI/Razorpay/Cash/
// Captain-Pays/Split flow and the payment_status state machine. This screen
// only exists so Booking Confirmation has somewhere to hand off to; it does
// not mark the booking CONFIRMED itself.
export function PaymentStubScreen({ navigation }: Props) {
  return (
    <View
      className="flex-1 bg-surface items-center justify-center px-6"
      testID="payment-stub-screen"
    >
      <Text className="font-display text-title-xl text-ink-black uppercase text-center">
        Payment
      </Text>
      <Text className="text-text-secondary text-body text-center mt-3">
        Payment (UPI, Razorpay, Cash, Captain Pays, Split) is built in module 2.4.
      </Text>
      <Pressable
        onPress={() => navigation.navigate('MyBookings')}
        className="bg-brand-red rounded-md py-4 px-8 items-center mt-8"
        testID="payment-stub-done-button"
      >
        <Text className="font-ui font-bold text-surface text-button uppercase">
          Back to My Bookings
        </Text>
      </Pressable>
    </View>
  );
}
