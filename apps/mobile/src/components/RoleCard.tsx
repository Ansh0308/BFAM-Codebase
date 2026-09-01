import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SelfServiceUserRole } from '@bfam/shared-types';

const ROLE_LABELS: Record<SelfServiceUserRole, { title: string; description: string }> = {
  PLAYER: { title: 'Player', description: 'Join matches, track your stats, get a BFAM ID.' },
  TURF_OWNER: {
    title: 'Turf Owner',
    description: 'List and manage your turf, pricing, and bookings.',
  },
  TURF_STAFF: { title: 'Turf Staff', description: 'Run bookings and score matches at your turf.' },
};

function RoleIcon({ role }: { role: SelfServiceUserRole }) {
  if (role === 'PLAYER') return <Feather name="user" size={26} color="#D80000" />;
  if (role === 'TURF_OWNER') {
    return <MaterialCommunityIcons name="office-building-outline" size={26} color="#D80000" />;
  }
  return <MaterialCommunityIcons name="whistle-outline" size={26} color="#D80000" />;
}

interface RoleCardProps {
  role: SelfServiceUserRole;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}

// Elevated card (radius-lg, shadow-card) per Design §7. Selected state uses
// a brand-red border — never a green/checkmark treatment.
export function RoleCard({ role, selected = false, onPress, testID }: RoleCardProps) {
  const { title, description } = ROLE_LABELS[role];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={[
        'flex-row items-center rounded-lg bg-surface p-4 mb-4 border shadow-card',
        selected ? 'border-brand-red' : 'border-border-subtle',
      ].join(' ')}
      style={{ minHeight: 44 }}
    >
      <View
        className="rounded-full bg-surface-alt items-center justify-center mr-4"
        style={{ width: 56, height: 56 }}
      >
        <RoleIcon role={role} />
      </View>
      <View className="flex-1">
        <Text className="font-ui font-semibold text-card-title text-ink-black">{title}</Text>
        <View className="h-0.5 w-6 bg-brand-red my-1.5" />
        <Text className="font-ui text-body text-text-secondary">{description}</Text>
      </View>
      <Feather name="chevron-right" size={22} color="#D80000" />
    </Pressable>
  );
}
