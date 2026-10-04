import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AuthScreenBackground } from '../src/components/AuthScreenBackground';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { useSignupStore } from '../src/store/signupStore';
import { BrandLogo } from '../src/components/BrandLogo';

// Placeholder liability-waiver copy (PRD §32.9) — standard assumption-of-
// risk language for a sports-booking app, NOT reviewed by legal counsel.
// Replace with counsel-approved wording before this ships to production;
// what matters functionally is that acceptance is a real, affirmative,
// per-user action (enforced server-side by registerUserSchema/
// socialCompleteSchema requiring waiver_accepted: true), not the exact text.
const WAIVER_TEXT =
  'I understand that cricket and other sports involve inherent risks of injury, and I voluntarily assume those risks for myself while using BFAM to book turfs and play matches. I release BFAM and participating turf venues from liability for injuries sustained during play, except where caused by their gross negligence.';

// Sign-up is for players only: Turf Owner / Turf Staff accounts are created
// by a BFAM admin (or, for staff, the turf owner) and those people simply log
// in — so there is no role to choose. This step now just collects the
// liability waiver (and an optional referral code) before Favorite Cricketer.
export default function RoleSelection() {
  const router = useRouter();
  const setRole = useSignupStore((s) => s.setRole);
  const waiverAccepted = useSignupStore((s) => s.waiverAccepted);
  const setWaiverAccepted = useSignupStore((s) => s.setWaiverAccepted);
  const referralCode = useSignupStore((s) => s.referralCode);
  const setReferralCode = useSignupStore((s) => s.setReferralCode);

  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!waiverAccepted) {
      setError('You must accept the liability waiver to continue.');
      return;
    }
    setError(null);
    setRole('PLAYER');
    router.push('/favorite-cricketer');
  }

  return (
    <AuthScreenBackground scroll>
      <View className="items-center mt-12 mb-6">
        <BrandLogo variant="horizontal" height={56} />
        <Text className="font-ui text-micro uppercase tracking-widest text-text-secondary mt-1">
          Play. Compete. Repeat.
        </Text>
        <View className="h-0.5 w-8 bg-brand-red mt-2" />
      </View>

      <View className="flex-row items-center justify-center mb-3">
        <View className="h-px w-8 bg-brand-red" />
        <Text className="font-ui font-bold text-section-header text-ink-black uppercase tracking-wide mx-3 text-center">
          Almost There
        </Text>
        <View className="h-px w-8 bg-brand-red" />
      </View>
      <Text className="font-ui text-body text-text-secondary text-center mb-8">
        Create your player account — book turfs, build teams and play matches.
      </Text>

      <TextField
        label="Referral Code (optional)"
        value={referralCode}
        onChangeText={setReferralCode}
        placeholder="A friend's BFAM ID, e.g. BF1001"
        autoCapitalize="characters"
        testID="referral-code-input"
      />

      <Pressable
        onPress={() => setWaiverAccepted(!waiverAccepted)}
        className="flex-row items-start mb-6"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: waiverAccepted }}
        testID="waiver-checkbox"
        hitSlop={8}
      >
        <View
          className={
            waiverAccepted ? 'bg-brand-red border-brand-red' : 'bg-surface border-border-strong'
          }
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            borderWidth: 1.5,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          {waiverAccepted ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
        </View>
        <Text className="font-ui text-micro text-text-secondary ml-3 flex-1">{WAIVER_TEXT}</Text>
      </Pressable>

      {error ? <Text className="font-ui text-body text-brand-red-dark mb-4">{error}</Text> : null}

      <View className="mb-10">
        <Button
          label="Continue"
          onPress={handleContinue}
          testID="role-selection-continue"
          iconRight={<Feather name="arrow-right" size={18} color="#FFFFFF" />}
        />
      </View>
    </AuthScreenBackground>
  );
}
