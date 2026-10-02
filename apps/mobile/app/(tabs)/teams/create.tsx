import React, { useState } from 'react';
import { Alert, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Feather } from '@expo/vector-icons';
import type { TeamSkillLevel } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../src/lib/apiClient';
import { TextField } from '../../../src/components/TextField';
import { ToggleRow } from '../../../src/components/ToggleRow';
import { Reveal } from '../../../src/components/Reveal';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { colors } from '../../../src/theme/tokens';
import {
  CreateTeamSubmitButton,
  MinSkillRatingHelp,
  OpenForPlayersInfoCard,
  SkillLevelChips,
  TeamLogoPicker,
  TeamTipCard,
  type SubmitState,
} from '../../../src/components/teams/CreateTeamParts';
import teamsBg from '../../../src/assets/images/teams-bg.jpg';

const HERO_HEIGHT = 300;

// Create Team (PRD §12.3): name, description, skill level, home city, logo,
// and whether it's open for players to discover. The creator becomes
// Captain automatically (enforced server-side, atomically, with the
// booking). Presentation-only redesign — every field, the validation, and
// the copy-from-existing-team prefill (backlog A-11) behave exactly as
// before; the Team Logo picker (upload to S3, same contract as the profile
// photo picker) is the one new piece of functionality, matching
// CreateTeamInput.team_logo_url which already existed but had no UI.
export default function CreateTeamScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    copyFromTeamName?: string;
    copyFromDescription?: string;
    copyFromHomeCity?: string;
    copyFromSkillLevel?: string;
    copyFromIsOpen?: string;
  }>();
  const [teamName, setTeamName] = useState(params.copyFromTeamName ?? '');
  const [description, setDescription] = useState(params.copyFromDescription ?? '');
  const [homeCity, setHomeCity] = useState(params.copyFromHomeCity ?? '');
  const [skillLevel, setSkillLevel] = useState<TeamSkillLevel | null>(
    (params.copyFromSkillLevel as TeamSkillLevel) || null,
  );
  const [isOpen, setIsOpen] = useState(
    params.copyFromIsOpen != null ? params.copyFromIsOpen === 'true' : true,
  );
  // Backlog B-8: a join request from below this Basic Skill Rating is
  // rejected server-side — blank means no constraint, same as today.
  const [minSkillRating, setMinSkillRating] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function pickLogo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a team logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    // Show the picked logo immediately (optimistic), then try to host it —
    // same pattern as profile-setup's photo picker.
    setLogoUrl(asset.uri);
    setLogoUploading(true);
    try {
      const { team_logo_url } = await apiClient.uploadTeamLogo(
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
      );
      setLogoUrl(team_logo_url);
    } catch (uploadError) {
      const status = (uploadError as { status?: number })?.status;
      if (status !== 501) {
        setError('Could not upload your logo. Please try again.');
      }
      // 501 (no S3 configured): keep the local URI — it still previews here,
      // it just won't be visible to other players until storage is set up.
    } finally {
      setLogoUploading(false);
    }
  }

  async function submit() {
    if (teamName.trim().length < 2) {
      setError('Give your team a name (at least 2 characters).');
      return;
    }
    if (minSkillRating && (Number.isNaN(Number(minSkillRating)) || Number(minSkillRating) < 0)) {
      setError('Minimum Skill Rating must be a whole number.');
      return;
    }
    setSubmitState('submitting');
    setError(null);
    try {
      const team = await apiClient.createTeam({
        team_name: teamName.trim(),
        description: description || null,
        home_city: homeCity || null,
        skill_level: skillLevel,
        is_open_for_players: isOpen,
        min_skill_rating: minSkillRating ? Number(minSkillRating) : null,
        team_logo_url: logoUrl,
      });
      setSubmitState('success');
      router.replace(`/(tabs)/teams/${team.team_id}`);
    } catch (err) {
      setSubmitState('idle');
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Could not create the team. Please try again.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="create-team-screen">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="px-5">
          <ScreenHeader title="Create Team" />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero: scrolls away with the rest of the form (no fixed/absolute
              background here, unlike Home/Matches) — this is a long form,
              not a list, so the hero only needs to own the first screenful. */}
          <View style={{ height: HERO_HEIGHT, overflow: 'hidden' }} testID="create-team-hero">
            <MotiView
              from={{ translateX: 14 }}
              animate={{ translateX: 0 }}
              transition={{ type: 'timing', duration: 900 }}
              style={{ position: 'absolute', top: 0, right: 0, width, height: HERO_HEIGHT }}
            >
              <Image
                source={teamsBg}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                contentPosition="right top"
                accessibilityElementsHidden
              />
            </MotiView>
            <LinearGradient
              colors={['rgba(255,255,255,0.0)', '#FFFFFF', '#FFFFFF']}
              locations={[0, 0.82, 1]}
              style={{ position: 'absolute', left: 0, right: 0, bottom: -2, height: 220 }}
            />

            <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
              <Reveal delay={40}>
                <Text
                  className="font-ui text-text-secondary"
                  style={{ fontSize: 11, letterSpacing: 3 }}
                >
                  BUILD • PLAY • GROW
                </Text>
              </Reveal>
              <MotiView
                from={{ width: 0 }}
                animate={{ width: 44 }}
                transition={{ type: 'timing', duration: 450, delay: 160 }}
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: colors.brandRed,
                  marginTop: 10,
                }}
              />
              <Reveal delay={120}>
                <Text
                  className="font-display text-ink-black"
                  style={{ fontSize: 48, lineHeight: 50, marginTop: 10 }}
                  testID="create-team-title"
                >
                  CREATE
                </Text>
                <Text
                  className="font-display text-brand-red"
                  style={{ fontSize: 48, lineHeight: 50 }}
                >
                  TEAM
                </Text>
              </Reveal>
              <Reveal delay={240}>
                <Text
                  className="font-ui text-ink-black"
                  style={{ fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: '62%' }}
                >
                  Start your own squad and play together.
                </Text>
              </Reveal>
            </View>
          </View>

          <View
            style={{
              paddingHorizontal: 20,
              marginTop: -4,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* The hero's red brush strokes stop at its own bottom edge, so
                the long form below used to read as a plain white page once
                scrolled past it. These are short diagonal slivers — the
                same short-rectangle-rotated-and-clipped technique
                AuthScreenBackground uses for its corner accents (Design
                §5's "diagonal geometric red shapes... a recurring
                signature motif") — repeated down the right edge at a few
                scroll positions instead of one shape that only covers the
                first screenful. */}
            {[260, 760, 1260].map((top) => (
              <View
                key={top}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top,
                  right: -58,
                  width: 90,
                  height: 190,
                  backgroundColor: colors.brandRed,
                  opacity: 0.1,
                  transform: [{ rotate: '25deg' }],
                }}
              />
            ))}
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: 520, left: -70, opacity: 0.03 }}
            >
              <Text
                className="font-display text-ink-black"
                style={{ fontSize: 100, letterSpacing: -2 }}
              >
                BFAM
              </Text>
            </View>

            <Reveal delay={60}>
              <TextField
                label="Team Name *"
                value={teamName}
                onChangeText={setTeamName}
                placeholder="e.g. Rajkot Strikers"
                iconLeft={<Feather name="users" size={16} />}
                testID="team-name-input"
              />
            </Reveal>

            <Reveal delay={110}>
              <TextField
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="What's your team about?"
                iconLeft={<Feather name="file-text" size={16} />}
                multiline
                maxLength={150}
                style={{ minHeight: 88, paddingTop: 12 }}
              />
              <Text
                className="font-ui text-text-tertiary"
                style={{ fontSize: 11, textAlign: 'right', marginTop: -12, marginBottom: 16 }}
              >
                {description.length}/150
              </Text>
            </Reveal>

            <Reveal delay={160}>
              <TextField
                label="Home City"
                value={homeCity}
                onChangeText={setHomeCity}
                placeholder="e.g. Rajkot"
                iconLeft={<Feather name="map-pin" size={16} />}
              />
            </Reveal>

            <Reveal delay={210}>
              <SkillLevelChips
                value={skillLevel}
                onChange={(v) => setSkillLevel(v as TeamSkillLevel)}
              />
            </Reveal>

            <Reveal delay={260}>
              <ToggleRow
                label="Open for new players"
                description="Lets players discover and request to join your team."
                value={isOpen}
                onValueChange={setIsOpen}
                testID="is-open-toggle"
              />
            </Reveal>

            {isOpen && <OpenForPlayersInfoCard />}

            {isOpen && (
              <Reveal delay={40}>
                <TextField
                  label="Minimum Skill Rating (Optional)"
                  value={minSkillRating}
                  onChangeText={setMinSkillRating}
                  placeholder="e.g. 600 — leave blank for no requirement"
                  iconLeft={<Feather name="bar-chart-2" size={16} />}
                  keyboardType="number-pad"
                  testID="min-skill-rating-input"
                />
                <MinSkillRatingHelp />
              </Reveal>
            )}

            <Reveal delay={40}>
              <TeamLogoPicker uri={logoUrl} uploading={logoUploading} onPress={pickLogo} />
            </Reveal>

            <View style={{ marginTop: 20 }}>
              <TeamTipCard />
            </View>

            {error && (
              <Text className="text-brand-red text-body mb-4" testID="create-team-error">
                {error}
              </Text>
            )}

            <CreateTeamSubmitButton
              state={submitState}
              onPress={submit}
              testID="submit-create-team"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
