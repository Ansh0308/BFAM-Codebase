import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SelfServiceUserRole } from '@bfam/shared-types';
import { AuthScreenBackground } from '../src/components/AuthScreenBackground';
import { RoleCard } from '../src/components/RoleCard';
import { Button } from '../src/components/Button';
import { useSignupStore } from '../src/store/signupStore';
import { useAuthStore } from '../src/store/authStore';
import { completeAccountCreation } from '../src/services/completeAccountCreation';

const SELF_SERVICE_ROLES: SelfServiceUserRole[] = ['PLAYER', 'TURF_OWNER', 'TURF_STAFF'];

// Placeholder liability-waiver copy (PRD §32.9) — standard assumption-of-
// risk language for a sports-booking app, NOT reviewed by legal counsel.
// Replace with counsel-approved wording before this ships to production;
// what matters functionally is that acceptance is a real, affirmative,
// per-user action (enforced server-side by registerUserSchema/
// socialCompleteSchema requiring waiver_accepted: true), not the exact text.
const WAIVER_TEXT =
  'I understand that cricket and other sports involve inherent risks of injury, and I voluntarily assume those risks for myself while using BFAM to book turfs and play matches. I release BFAM and participating turf venues from liability for injuries sustained during play, except where caused by their gross negligence.';

// Offers Player / Turf Owner / Turf Staff only — never Admin (self-service
// signups can't create an admin account). Only PLAYER continues to
// Favorite Cricketer Search; Owner/Staff create the account immediately.
export default function RoleSelection() {
  const router = useRouter();
  const setRole = useSignupStore((s) => s.setRole);
  const identifier = useSignupStore((s) => s.identifier);
  const password = useSignupStore((s) => s.password);
  const signupToken = useSignupStore((s) => s.signupToken);
  const socialTicket = useSignupStore((s) => s.socialTicket);
  const setSession = useAuthStore((s) => s.setSession);
  const waiverAccepted = useSignupStore((s) => s.waiverAccepted);
  const setWaiverAccepted = useSignupStore((s) => s.setWaiverAccepted);

  const [selected, setSelected] = useState<SelfServiceUserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) {
      setError('Choose a role to continue.');
      return;
    }
    if (!waiverAccepted) {
      setError('You must accept the liability waiver to continue.');
      return;
    }
    setError(null);
    setRole(selected);

    if (selected === 'PLAYER') {
      router.push('/favorite-cricketer');
      return;
    }

    // Turf Owner / Turf Staff go straight from Role Selection to account
    // creation (no Favorite Cricketer step).
    setLoading(true);
    try {
      const result = await completeAccountCreation({
        role: selected,
        identifier: identifier ?? '',
        password: password ?? '',
        signupToken,
        socialTicket,
        favoriteCricketerName: null,
        favoriteCricketerExternalId: null,
        waiverAccepted: true,
      });
      await setSession(result.token, {
        user_id: result.user_id,
        bfam_id: result.bfam_id,
        role: selected,
      });
      // Turf Owner/Staff never get a BFAM ID (PRD §12.59, updated — players
      // only), so there's nothing to show on BFAM ID Confirmation — go
      // straight to Profile Setup (Module 2.2), same as the PLAYER path.
      router.replace('/profile-setup');
    } catch {
      setError('Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenBackground scroll>
      <View className="items-center mt-12 mb-6">
        <Text className="font-display text-hero text-brand-red">BFAM</Text>
        <Text className="font-ui text-micro uppercase tracking-widest text-text-secondary mt-1">
          Play. Compete. Repeat.
        </Text>
        <View className="h-0.5 w-8 bg-brand-red mt-2" />
      </View>

      <View className="flex-row items-center justify-center mb-3">
        <View className="h-px w-8 bg-brand-red" />
        <Text className="font-ui font-bold text-section-header text-ink-black uppercase tracking-wide mx-3 text-center">
          Choose Your Role
        </Text>
        <View className="h-px w-8 bg-brand-red" />
      </View>
      <Text className="font-ui text-body text-text-secondary text-center mb-8">
        Select how you want to use BFAM and get started.
      </Text>

      {SELF_SERVICE_ROLES.map((role) => (
        <RoleCard
          key={role}
          role={role}
          selected={selected === role}
          onPress={() => setSelected(role)}
          testID={`role-card-${role}`}
        />
      ))}

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
          loading={loading}
          disabled={!waiverAccepted}
          testID="role-selection-continue"
          iconRight={<Feather name="arrow-right" size={18} color="#FFFFFF" />}
        />
      </View>
    </AuthScreenBackground>
  );
}
