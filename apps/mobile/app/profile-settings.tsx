import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { apiClient } from '../src/lib/apiClient';

interface SettingsRowConfig {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  route: string;
  testID: string;
}

const ROWS: SettingsRowConfig[] = [
  {
    icon: 'user',
    label: 'Edit Profile',
    route: '/profile-setup',
    testID: 'settings-row-edit-profile',
  },
  {
    icon: 'bell',
    label: 'Notification Settings',
    route: '/notification-settings',
    testID: 'settings-row-notifications',
  },
  {
    icon: 'lock',
    label: 'Privacy Settings',
    route: '/privacy-settings',
    testID: 'settings-row-privacy',
  },
  {
    icon: 'credit-card',
    label: 'Payment Methods',
    route: '/payment-methods',
    testID: 'settings-row-payment',
  },
  { icon: 'globe', label: 'Language', route: '/language', testID: 'settings-row-language' },
  {
    icon: 'help-circle',
    label: 'Help Center',
    route: '/help-center',
    testID: 'settings-row-help-center',
  },
];

// Settings hub — a plain list of rows that push into each sub-screen. Email
// is shown separately (not in the static ROWS list above) because its
// label needs a live registered/not-registered status pulled from the
// profile.
export default function ProfileSettings() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailLoaded, setEmailLoaded] = useState(false);

  useEffect(() => {
    apiClient
      .getMyProfile()
      .then((profile) => {
        setEmail(profile.email);
        setEmailVerified(Boolean(profile.email_verified_at));
        setEmailLoaded(true);
      })
      .catch(() => {
        setEmailLoaded(true);
      });
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-5" testID="profile-settings-screen">
        <ScreenHeader title="Settings" />

        <View className="mt-2">
          <SettingsRow
            icon="mail"
            label="Email"
            status={
              emailLoaded ? (emailVerified ? (email ?? 'Verified') : 'Not verified') : undefined
            }
            statusRegistered={emailVerified}
            testID="settings-row-email"
            onPress={() => router.push('/email-settings')}
          />
          {ROWS.map((row) => (
            <SettingsRow
              key={row.route}
              icon={row.icon}
              label={row.label}
              testID={row.testID}
              onPress={() => router.push(row.route as never)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({
  icon,
  label,
  status,
  statusRegistered,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  status?: string;
  statusRegistered?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      className="flex-row items-center justify-between py-4 border-b border-border-subtle"
      style={{ minHeight: 44 }}
    >
      <View className="flex-row items-center">
        <Feather name={icon} size={18} color="#D80000" />
        <Text className="font-ui text-body text-text-primary ml-3">{label}</Text>
      </View>
      <View className="flex-row items-center">
        {status ? (
          <Text
            className={[
              'font-ui text-micro mr-2',
              statusRegistered ? 'text-text-secondary' : 'text-text-tertiary',
            ].join(' ')}
            testID={`${testID}-status`}
          >
            {status}
          </Text>
        ) : null}
        <Feather name="chevron-right" size={18} color="#767676" />
      </View>
    </Pressable>
  );
}
