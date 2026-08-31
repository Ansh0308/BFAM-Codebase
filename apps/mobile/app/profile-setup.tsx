import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { AuthScreenBackground } from '../src/components/AuthScreenBackground';
import { Avatar } from '../src/components/Avatar';
import { ChipSelect } from '../src/components/ChipSelect';
import { DateOfBirthField } from '../src/components/DateOfBirthField';
import { Button } from '../src/components/Button';
import {
  AVATAR_PRESETS,
  presetUriFromId,
  isPresetAvatarUri,
  presetIdFromUri,
} from '../src/components/AvatarPresets';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';

const PLAYING_ROLES = [
  { value: 'BATTER', label: 'Batter' },
  { value: 'BOWLER', label: 'Bowler' },
  { value: 'ALL_ROUNDER', label: 'All-Rounder' },
  { value: 'WICKET_KEEPER', label: 'Wicket-Keeper' },
];
const BATTING_STYLES = [
  { value: 'RIGHT_HANDED', label: 'Right-Handed' },
  { value: 'LEFT_HANDED', label: 'Left-Handed' },
];
const BOWLING_ARMS = [
  { value: 'LEFT_ARM', label: 'Left-Arm' },
  { value: 'RIGHT_ARM', label: 'Right-Arm' },
];
const EXPERIENCE_LEVELS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
];
const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

// Profile Setup (PRD §12.2) — reached right after onboarding (from
// bfam-id-confirmation.tsx / role-selection.tsx) and again later from the
// Profile tab's "Edit Profile". Cricket-specific fields (playing role,
// batting/bowling style, experience) only apply to PLAYER accounts —
// Turf Owner/Staff only see the photo field.
//
// Two ways to set a photo: upload a real one (see pickPhoto — local-URI
// fallback if S3 isn't configured, see uploadService.ts) or pick one of the
// bundled icon-avatar presets (AvatarPresets.ts) — a substitute for hand-
// drawn cartoon art, which isn't something this pipeline can produce.
export default function ProfileSetup() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const isPlayer = authUser?.role === 'PLAYER';

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [playingRole, setPlayingRole] = useState<string | null>(null);
  const [battingStyle, setBattingStyle] = useState<string | null>(null);
  const [bowlingStyle, setBowlingStyle] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoNotHosted, setPhotoNotHosted] = useState(false);

  useEffect(() => {
    apiClient
      .getMyProfile()
      .then((profile) => {
        setPhotoUri(profile.profile_photo_url);
        setPlayingRole(profile.playing_role);
        setBattingStyle(profile.batting_style);
        setBowlingStyle(profile.bowling_style);
        setExperienceLevel(profile.experience_level);
        setDateOfBirth(profile.date_of_birth);
        setGender(profile.gender);
      })
      .catch(() => {
        // First-run for a brand-new account — nothing to prefill yet.
      });
  }, []);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
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
    // Show the picked photo immediately (optimistic), then try to host it.
    setPhotoUri(asset.uri);
    setPhotoNotHosted(false);
    setPhotoUploading(true);
    try {
      const { profile_photo_url } = await apiClient.uploadProfilePhoto(
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
      );
      setPhotoUri(profile_photo_url);
    } catch (uploadError) {
      const status = (uploadError as { status?: number })?.status;
      if (status === 501) {
        // Server has no photo storage configured yet — keep the local URI
        // so the picker still "works" for the user picking it, but it will
        // only be visible on this device until storage is wired up.
        setPhotoNotHosted(true);
      } else {
        setError('Could not upload your photo. Please try again.');
      }
    } finally {
      setPhotoUploading(false);
    }
  }

  function pickPreset(id: string) {
    setPhotoUri(presetUriFromId(id));
    setPhotoNotHosted(false);
  }

  async function handleSave() {
    setError(null);

    if (isPlayer && !dateOfBirth) {
      setError('Date of birth is required.');
      return;
    }
    if (isPlayer && !gender) {
      setError('Gender is required.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.updateMyProfile({
        profile_photo_url: photoUri,
        ...(isPlayer
          ? {
              playing_role: playingRole,
              batting_style: battingStyle,
              bowling_style: bowlingStyle,
              date_of_birth: dateOfBirth,
              gender,
              ...(experienceLevel ? { experience_level: experienceLevel } : {}),
            }
          : {}),
      });
      router.replace('/(tabs)/home');
    } catch {
      setError('Could not save your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const selectedPresetId = isPresetAvatarUri(photoUri) ? presetIdFromUri(photoUri as string) : null;

  return (
    <AuthScreenBackground scroll>
      <View className="items-center mt-10 mb-8">
        <Text className="font-display text-title-xl uppercase text-ink-black">
          Set Up Your Profile
        </Text>
        <Text className="font-ui text-body text-text-secondary text-center mt-2 px-5">
          {isPlayer
            ? 'Tell us a bit about how you play.'
            : 'Add a photo so players and staff recognize you.'}
        </Text>
      </View>

      <View className="items-center mb-4">
        <Pressable onPress={pickPhoto} disabled={photoUploading} testID="profile-photo-picker">
          <Avatar uri={photoUri} size={96} />
          {photoUploading ? (
            <View
              className="absolute inset-0 items-center justify-center bg-black/30"
              style={{ borderRadius: 48 }}
              testID="profile-photo-uploading"
            >
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}
          <View
            className="absolute bottom-0 right-0 bg-brand-red rounded-full items-center justify-center"
            style={{ width: 28, height: 28 }}
          >
            <Feather name="camera" size={14} color="#FFFFFF" />
          </View>
        </Pressable>
        {photoNotHosted ? (
          <Text
            className="font-ui text-micro text-text-tertiary text-center mt-2 px-8"
            testID="profile-photo-not-hosted-note"
          >
            Photo hosting isn't configured yet — this photo is only visible on this device.
          </Text>
        ) : null}
      </View>

      <View className="mb-8">
        <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2 text-center">
          Or pick an avatar
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="avatar-preset-list">
          <View className="flex-row" style={{ gap: 12 }}>
            {AVATAR_PRESETS.map((preset) => {
              const isSelected = preset.id === selectedPresetId;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => pickPreset(preset.id)}
                  testID={`avatar-preset-${preset.id}`}
                  className="items-center justify-center"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: preset.bg,
                    borderWidth: isSelected ? 3 : 0,
                    borderColor: '#0D0D0D',
                  }}
                >
                  <Feather name={preset.icon} size={22} color="#FFFFFF" />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {isPlayer ? (
        <>
          <ChipSelect
            label="Playing Role"
            options={PLAYING_ROLES}
            value={playingRole}
            onChange={setPlayingRole}
            testID="playing-role"
          />
          <ChipSelect
            label="Batting Style"
            options={BATTING_STYLES}
            value={battingStyle}
            onChange={setBattingStyle}
            testID="batting-style"
          />
          <ChipSelect
            label="Bowling Style"
            options={BOWLING_ARMS}
            value={bowlingStyle}
            onChange={setBowlingStyle}
            testID="bowling-style"
          />
          <ChipSelect
            label="Experience"
            options={EXPERIENCE_LEVELS}
            value={experienceLevel}
            onChange={setExperienceLevel}
            testID="experience-level"
          />
          <ChipSelect
            label="Gender"
            options={GENDERS}
            value={gender}
            onChange={setGender}
            testID="gender"
          />
          <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} testID="date-of-birth" />
        </>
      ) : null}

      {error ? (
        <Text className="font-ui text-body text-brand-red-dark mb-4" testID="profile-setup-error">
          {error}
        </Text>
      ) : null}

      <View className="mb-10">
        <Button
          label="Continue"
          onPress={handleSave}
          loading={loading}
          disabled={photoUploading}
          testID="profile-setup-save"
          iconRight={<Feather name="arrow-right" size={18} color="#FFFFFF" />}
        />
      </View>
    </AuthScreenBackground>
  );
}
