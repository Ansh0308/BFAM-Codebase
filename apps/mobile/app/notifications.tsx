import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { Notification, NotificationPreferenceCategory } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

const FILTERS: { value: NotificationPreferenceCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'match_updates', label: 'Matches' },
  { value: 'booking_reminders', label: 'Bookings' },
  { value: 'team_invites', label: 'Teams' },
  { value: 'promotions', label: 'Promotions' },
];

// Notification Center (module 2.11 requirement 1): filter tabs + mark-all-
// read, over the notifications module 2.11's notificationService funnels
// every module's events into.
export default function NotificationsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationPreferenceCategory | 'all'>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getNotifications(filter === 'all' ? undefined : filter)
      .then((res) => setNotifications(res.results))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await apiClient.markAllNotificationsRead();
      await load();
    } finally {
      setMarkingAll(false);
    }
  }

  async function openNotification(notification: Notification) {
    if (!notification.read_at) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notification.notification_id
            ? { ...n, read_at: new Date().toISOString() }
            : n,
        ),
      );
      apiClient.markNotificationRead(notification.notification_id).catch(() => {});
    }
    if (notification.related_entity_type === 'match' && notification.related_entity_id) {
      router.push(`/(tabs)/matches/${notification.related_entity_id}`);
    } else if (notification.related_entity_type === 'team' && notification.related_entity_id) {
      router.push(`/(tabs)/teams/${notification.related_entity_id}`);
    } else if (notification.related_entity_type === 'booking' && notification.related_entity_id) {
      router.push(`/(tabs)/discover/booking/${notification.related_entity_id}`);
    }
  }

  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-5 pt-4 mb-2">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="notifications-back"
          >
            <Feather name="arrow-left" size={22} color="#0D0D0D" />
          </Pressable>
          <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">Notifications</Text>
        </View>
        {hasUnread && (
          <Pressable
            onPress={markAllRead}
            disabled={markingAll}
            accessibilityRole="button"
            testID="mark-all-read-button"
          >
            <Text className="font-ui text-body text-brand-red">Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(f) => f.value}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        style={{ flexGrow: 0, marginBottom: 8 }}
        testID="notification-filter-tabs"
        renderItem={({ item }) => {
          const selected = item.value === filter;
          return (
            <Pressable
              onPress={() => setFilter(item.value)}
              className={`rounded-full px-4 py-2 mr-2 border ${
                selected ? 'bg-brand-red border-brand-red' : 'bg-surface border-border-strong'
              }`}
              testID={`notification-filter-${item.value}`}
            >
              <Text
                className={`font-ui text-body ${selected ? 'text-surface' : 'text-text-primary'}`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        }}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="notifications-loading" />
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className="font-ui text-body text-text-tertiary text-center"
            testID="notifications-empty"
          >
            Nothing here yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.notification_id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          testID="notifications-list"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openNotification(item)}
              className="flex-row items-start py-4 border-b border-border-subtle"
              testID={`notification-row-${item.notification_id}`}
            >
              {!item.read_at && (
                <View
                  className="bg-brand-red rounded-full mt-2 mr-3"
                  style={{ width: 8, height: 8 }}
                  testID={`notification-unread-dot-${item.notification_id}`}
                />
              )}
              <View className="flex-1" style={!item.read_at ? undefined : { marginLeft: 20 }}>
                <Text className="font-ui font-bold text-body text-text-primary">{item.title}</Text>
                <Text className="font-ui text-body text-text-secondary mt-1">{item.body}</Text>
                <Text className="font-ui text-micro text-text-tertiary mt-1">
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
