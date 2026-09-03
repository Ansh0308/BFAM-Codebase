import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../src/components/ScreenHeader';

// Help Center (module 2.13, PRD §12.57) — entry point for Contact Support
// and Complaint Status, reached from Profile/Settings.
export default function HelpCenterScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="px-5 flex-1" testID="help-center-screen">
        <ScreenHeader title="Help Center" />

        <MenuRow
          icon="message-circle"
          label="Contact Support"
          onPress={() => router.push('/contact-support')}
          testID="menu-contact-support"
        />
        <MenuRow
          icon="list"
          label="Complaint Status"
          onPress={() => router.push('/complaint-status')}
          testID="menu-complaint-status"
        />
        <MenuRow
          icon="heart"
          label="Report an Injury"
          onPress={() => router.push('/injury-report')}
          testID="menu-injury-report"
        />
      </View>
    </SafeAreaView>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-4 border-b border-border-subtle"
      testID={testID}
    >
      <View className="flex-row items-center">
        <Feather name={icon} size={18} color="#D80000" />
        <Text className="font-ui text-body text-text-primary ml-3">{label}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#9A9A9A" />
    </Pressable>
  );
}
