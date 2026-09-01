import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { useSignupStore } from '../src/store/signupStore';

// Lightweight phone-number-collection step for a brand-new Google/Apple
// user (no matching google_id/apple_id): users.phone_number is NOT NULL and
// social tokens don't reliably provide one, so this step runs before Role
// Selection for the social branch only.
export default function SocialPhone() {
  const router = useRouter();
  const setPhonePasswordSignup = useSignupStore((s) => s.setPhonePasswordSignup);
  const socialTicket = useSignupStore((s) => s.socialTicket);

  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!socialTicket) {
      setError('Social sign-in session expired. Please try again.');
      return;
    }
    if (phone.trim().length < 7) {
      setError('Enter a valid phone number.');
      return;
    }
    setError(null);
    // Reuse the identifier slot to carry the phone number through to
    // role-selection / favorite-cricketer, which read it when calling
    // completeSocialSignup.
    setPhonePasswordSignup(phone.trim(), '');
    router.push('/role-selection');
  }

  return (
    <ScreenContainer scroll>
      <View className="mt-10 mb-8">
        <Text className="font-ui font-bold text-title-xl text-ink-black">Add Your Phone</Text>
        <Text className="font-ui text-body text-text-secondary mt-2">
          BFAM needs a phone number to finish setting up your account.
        </Text>
      </View>

      <TextField
        label="Phone Number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        testID="social-phone-input"
      />

      {error ? <Text className="font-ui text-body text-brand-red-dark mb-4">{error}</Text> : null}

      <Button label="Continue" onPress={handleContinue} testID="social-phone-submit" />
    </ScreenContainer>
  );
}
