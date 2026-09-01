import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { TeamSkillLevel } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../src/lib/apiClient';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { Button } from '../../../src/components/Button';
import { TextField } from '../../../src/components/TextField';
import { ChipSelect } from '../../../src/components/ChipSelect';
import { ToggleRow } from '../../../src/components/ToggleRow';

const SKILL_LEVELS: { value: TeamSkillLevel; label: string }[] = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
  { value: 'MIXED', label: 'Mixed' },
];

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
        <TextField
          label="Team Name"
          value={teamName}
          onChangeText={setTeamName}
          placeholder="e.g. Rajkot Strikers"
          testID="team-name-input"
        />

        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What's your team about?"
          multiline
          style={{ minHeight: 72, paddingTop: 12 }}
        />

        <TextField
          label="Home City"
          value={homeCity}
          onChangeText={setHomeCity}
          placeholder="e.g. Rajkot"
        />

        <ChipSelect
          label="Skill Level"
          options={SKILL_LEVELS}
          value={skillLevel}
          onChange={(v) => setSkillLevel(v as TeamSkillLevel)}
          testID="skill-level"
        />

        <View className="mb-6">
          <ToggleRow
            label="Open for new players"
            description="Lets players discover and request to join your team."
            value={isOpen}
            onValueChange={setIsOpen}
            testID="is-open-toggle"
          />
        </View>

        {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

        <View className="mb-10">
          <Button
            label="Create Team"
            onPress={submit}
            loading={submitting}
            testID="submit-create-team"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
