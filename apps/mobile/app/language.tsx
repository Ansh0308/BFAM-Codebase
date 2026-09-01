import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { apiClient } from '../src/lib/apiClient';

// Real, persisted setting — Stack §9.5 lists English/Hindi/Gujarati.
// Saves immediately to users.preferred_language on selection.
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'gu', label: 'Gujarati' },
];

export default function Language() {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getMyProfile()
      .then((profile) => setSelected(profile.preferred_language ?? 'en'))
      .catch(() => setSelected('en'));
  }, []);

  async function handleSelect(code: string) {
    setSaving(code);
    try {
      await apiClient.updateMyProfile({ preferred_language: code });
      setSelected(code);
    } finally {
      setSaving(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-5" testID="language-screen">
        <ScreenHeader title="Language" />

        <View className="mt-2">
          {LANGUAGES.map((lang) => {
            const isSelected = selected === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => handleSelect(lang.code)}
                testID={`language-option-${lang.code}`}
                className="flex-row items-center justify-between py-4 border-b border-border-subtle"
                style={{ minHeight: 44 }}
              >
                <Text className="font-ui text-body text-text-primary">{lang.label}</Text>
                {saving === lang.code ? (
                  <ActivityIndicator color="#D80000" size="small" />
                ) : isSelected ? (
                  <Feather
                    name="check"
                    size={18}
                    color="#D80000"
                    testID={`language-check-${lang.code}`}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
