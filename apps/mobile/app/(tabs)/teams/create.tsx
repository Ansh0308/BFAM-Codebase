import React, { useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { TeamSkillLevel } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../src/lib/apiClient';
import { colors } from '../../../src/theme/tokens';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { Button } from '../../../src/components/Button';

const SKILL_LEVELS: TeamSkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MIXED'];

// Create Team (PRD §12.3): name, description, skill level, home city, and
// whether it's open for players to discover. The creator becomes Captain
// automatically (enforced server-side, atomically, with the booking).
export default function CreateTeamScreen() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [skillLevel, setSkillLevel] = useState<TeamSkillLevel | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (teamName.trim().length < 2) {
      setError('Give your team a name (at least 2 characters).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const team = await apiClient.createTeam({
        team_name: teamName.trim(),
        description: description || null,
        home_city: homeCity || null,
        skill_level: skillLevel,
        is_open_for_players: isOpen,
      });
      router.replace(`/(tabs)/teams/${team.team_id}`);
    } catch (err) {
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Could not create the team. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <View className="pt-4" testID="create-team-screen">
        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
          Team Name
        </Text>
        <TextInput
          value={teamName}
          onChangeText={setTeamName}
          placeholder="e.g. Rajkot Strikers"
          placeholderTextColor={colors.textTertiary}
          className="bg-surface-alt border border-border-strong rounded-md px-4 py-3 mb-4 font-ui text-body text-text-primary"
          testID="team-name-input"
        />

        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
          Description
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          placeholderTextColor={colors.textTertiary}
          className="bg-surface-alt border border-border-strong rounded-md px-4 py-3 mb-4 font-ui text-body text-text-primary min-h-[72px]"
        />

        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
          Home City
        </Text>
        <TextInput
          value={homeCity}
          onChangeText={setHomeCity}
          placeholderTextColor={colors.textTertiary}
          className="bg-surface-alt border border-border-strong rounded-md px-4 py-3 mb-4 font-ui text-body text-text-primary"
        />

        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
          Skill Level
        </Text>
        <View className="flex-row flex-wrap mb-4">
          {SKILL_LEVELS.map((level) => {
            const selected = skillLevel === level;
            return (
              <View key={level} className="mr-2 mb-2">
                <Button
                  label={level}
                  variant={selected ? 'primary' : 'secondary'}
                  fullWidth={false}
                  onPress={() => setSkillLevel(level)}
                  testID={`skill-level-${level}`}
                />
              </View>
            );
          })}
        </View>

        <View className="flex-row items-center justify-between mb-6">
          <Text className="font-ui text-body text-text-primary">Open for new players to join</Text>
          <Switch value={isOpen} onValueChange={setIsOpen} testID="is-open-toggle" />
        </View>

        {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

        <Button
          label="Create Team"
          onPress={submit}
          loading={submitting}
          testID="submit-create-team"
        />
      </View>
    </ScreenContainer>
  );
}
