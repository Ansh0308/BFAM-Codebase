import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../../../../src/components/ScreenContainer';
import { Button } from '../../../../../src/components/Button';

// Deliberate stub — module 2.4 (Payments) owns the real UPI/Razorpay/Cash/
// Captain-Pays/Split flow and the payment_status state machine. This screen
// only exists so Booking Confirmation has somewhere to hand off to; it does
// not mark the booking CONFIRMED itself.
export default function PaymentStubScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center" testID="payment-stub-screen">
        <Text className="font-display text-title-xl text-ink-black uppercase text-center">
          Payment
        </Text>
        <Text className="font-ui text-body text-text-secondary text-center mt-3">
          Payment (UPI, Razorpay, Cash, Captain Pays, Split) is built in module 2.4.
        </Text>
        <View className="mt-8 w-full">
          <Button
            label="Back to My Bookings"
            onPress={() => router.push('/(tabs)/discover/my-bookings')}
            testID="payment-stub-done-button"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
