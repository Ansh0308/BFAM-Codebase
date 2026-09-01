import React, { useState } from 'react';
import { View, Text } from 'react-native';
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

  const [selected, setSelected] = useState<SelfServiceUserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) {
      setError('Choose a role to continue.');
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

      {error ? <Text className="font-ui text-body text-brand-red-dark mb-4">{error}</Text> : null}

      <View className="mb-10">
        <Button
          label="Continue"
          onPress={handleContinue}
          loading={loading}
          testID="role-selection-continue"
          iconRight={<Feather name="arrow-right" size={18} color="#FFFFFF" />}
        />
      </View>
    </AuthScreenBackground>
  );
}
