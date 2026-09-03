import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NotificationPreferenceCategory, NotificationPreferences } from '@bfam/shared-types';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { ToggleRow } from '../src/components/ToggleRow';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

const TOGGLES: { key: NotificationPreferenceCategory; label: string; description: string }[] = [
  {
    key: 'match_updates',
    label: 'Match Updates',
    description: 'Invites, confirmations, results, and rating changes',
  },
  {
    key: 'booking_reminders',
    label: 'Booking Reminders',
    description: 'Booking confirmations and reminders before your turf slot',
  },
  {
    key: 'team_invites',
    label: 'Team Invites',
    description: 'When a captain invites you to a team',
  },
  {
    key: 'promotions',
    label: 'Promotions',
    description: 'Rewards, tournament updates, and announcements from BFAM',
  },
];

// Notification preferences (module 2.2, persisted for real by module
// 2.11 — every push notificationService sends checks these same four
// categories before delivering, so a toggle here takes effect immediately.
export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<NotificationPreferenceCategory | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getNotificationPreferences()
      .then(setPreferences)
      .catch(() => setPreferences(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(key: NotificationPreferenceCategory, value: boolean) {
    if (!preferences) return;
    const previous = preferences;
    setPreferences({ ...preferences, [key]: value });
    setSaving(key);
    try {
      await apiClient.updateNotificationPreferences({ [key]: value });
    } catch {
      setPreferences(previous);
    } finally {
      setSaving(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-5" testID="notification-settings-screen">
        <ScreenHeader title="Notifications" />

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            style={{ marginTop: 24 }}
            testID="notification-settings-loading"
          />
        ) : !preferences ? (
          <Text className="font-ui text-body text-text-secondary mt-6">
            Could not load your notification preferences.
          </Text>
        ) : (
          <View className="mt-2">
            {TOGGLES.map((t) => (
              <ToggleRow
                key={t.key}
                label={t.label}
                description={t.description}
                value={preferences[t.key]}
                onValueChange={(value) => toggle(t.key, value)}
                disabled={saving === t.key}
                testID={`toggle-${t.key.replace(/_/g, '-')}`}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
