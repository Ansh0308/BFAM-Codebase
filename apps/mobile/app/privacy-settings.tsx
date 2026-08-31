import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { ToggleRow } from '../src/components/ToggleRow';

// Privacy preferences. Same caveat as Notification Settings: no backing
// column/table exists in the DB doc for any of these, so this screen is
// local-state-only for now — flagged rather than silently invented.
export default function PrivacySettings() {
  const [showProfileToPublic, setShowProfileToPublic] = useState(true);
  const [showStatsToPublic, setShowStatsToPublic] = useState(true);
  const [allowTeamInvites, setAllowTeamInvites] = useState(true);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-5" testID="privacy-settings-screen">
        <ScreenHeader title="Privacy" />

        <Text className="font-ui text-micro text-text-tertiary mt-2 mb-2">
          These preferences are not saved yet — they'll reset on next launch until this is backed by
          real storage.
        </Text>

        <View className="mt-2">
          <ToggleRow
            label="Public Profile"
            description="Let other users view your profile"
            value={showProfileToPublic}
            onValueChange={setShowProfileToPublic}
            testID="toggle-public-profile"
          />
          <ToggleRow
            label="Show Stats Publicly"
            description="Career stats and ratings visible to others"
            value={showStatsToPublic}
            onValueChange={setShowStatsToPublic}
            testID="toggle-public-stats"
          />
          <ToggleRow
            label="Allow Team Invites"
            description="Let captains invite you directly"
            value={allowTeamInvites}
            onValueChange={setAllowTeamInvites}
            testID="toggle-team-invites-privacy"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
