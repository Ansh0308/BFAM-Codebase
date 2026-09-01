import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { ToggleRow } from '../src/components/ToggleRow';

// Notification preferences. NOTE: there is no notification-preferences
// table/column in the DB doc, so these toggles are local-state-only for
// now — flipping them does not persist anywhere. Flagging rather than
// inventing a schema; wire this up to real storage once the DB doc adds
// one.
export default function NotificationSettings() {
  const [matchUpdates, setMatchUpdates] = useState(true);
  const [bookingReminders, setBookingReminders] = useState(true);
  const [teamInvites, setTeamInvites] = useState(true);
  const [promotions, setPromotions] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-5" testID="notification-settings-screen">
        <ScreenHeader title="Notifications" />

        <Text className="font-ui text-micro text-text-tertiary mt-2 mb-2">
          These preferences are not saved yet — they'll reset on next launch until this is backed by
          real storage.
        </Text>

        <View className="mt-2">
          <ToggleRow
            label="Match Updates"
            description="Live score alerts for matches you follow"
            value={matchUpdates}
            onValueChange={setMatchUpdates}
            testID="toggle-match-updates"
          />
          <ToggleRow
            label="Booking Reminders"
            description="Reminders before your turf slot starts"
            value={bookingReminders}
            onValueChange={setBookingReminders}
            testID="toggle-booking-reminders"
          />
          <ToggleRow
            label="Team Invites"
            description="When a captain invites you to a team"
            value={teamInvites}
            onValueChange={setTeamInvites}
            testID="toggle-team-invites"
          />
          <ToggleRow
            label="Promotions"
            description="Offers and announcements from BFAM"
            value={promotions}
            onValueChange={setPromotions}
            testID="toggle-promotions"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
