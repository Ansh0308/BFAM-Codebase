import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { colors } from '../../theme/tokens';

// ---- Skill Level ----------------------------------------------------
//
// A dedicated chip for this screen rather than the shared ChipSelect: the
// design calls for an outlined selected state (white bg, red border, red
// icon) instead of ChipSelect's filled-red selected state used everywhere
// else in the app (Playing Role, Create Match, etc.) — changing that shared
// component would restyle chips on screens this redesign doesn't touch.
const SKILL_LEVEL_OPTIONS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
  { value: 'MIXED', label: 'Mixed' },
] as const;

function SkillChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <MotiView
      animate={{ scale: pressed ? 0.97 : 1 }}
      transition={{ type: 'timing', duration: 180 }}
      style={{ width: '31%', marginRight: '3.5%', marginBottom: 10 }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className="flex-row items-center justify-center"
        style={{
          height: 52,
          borderRadius: 11,
          borderWidth: selected ? 1.5 : 1,
          borderColor: selected ? colors.brandRed : '#E8E8E8',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 4,
        }}
      >
        <Feather
          name="bar-chart-2"
          size={12}
          color={selected ? colors.brandRed : '#767676'}
          style={{ marginRight: 4 }}
        />
        <Text
          className="font-ui"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{
            fontSize: 12.5,
            fontWeight: selected ? '700' : '500',
            color: selected ? colors.brandRed : '#111111',
          }}
        >
          {label}
        </Text>
      </Pressable>
    </MotiView>
  );
}

export function SkillLevelChips({
  value,
  onChange,
  testID = 'skill-level',
}: {
  value: string | null;
  onChange: (value: string) => void;
  testID?: string;
}) {
  return (
    <View className="mb-5" testID={testID}>
      <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
        Skill Level *
      </Text>
      <View className="flex-row flex-wrap">
        {SKILL_LEVEL_OPTIONS.map((opt) => (
          <SkillChip
            key={opt.value}
            label={opt.label}
            selected={value === opt.value}
            onPress={() => onChange(opt.value)}
            testID={`${testID}-${opt.value}`}
          />
        ))}
      </View>
    </View>
  );
}

// ---- "Open for new players" info card --------------------------------

export function OpenForPlayersInfoCard() {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FDECEC',
        borderLeftWidth: 3,
        borderLeftColor: colors.brandRed,
        borderRadius: 10,
        padding: 14,
        marginTop: 12,
        marginBottom: 20,
      }}
      testID="open-for-players-info"
    >
      <Feather name="users" size={18} color={colors.brandRed} style={{ marginTop: 1 }} />
      <View className="flex-1 ml-3">
        <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 14 }}>
          More players, stronger games!
        </Text>
        <Text className="font-ui text-text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
          Keep this on to let other players find and join your team.
        </Text>
      </View>
    </MotiView>
  );
}

// ---- Minimum skill rating helper note ---------------------------------

export function MinSkillRatingHelp() {
  return (
    <View
      className="flex-row items-start"
      style={{
        backgroundColor: '#F8F8F8',
        borderRadius: 10,
        padding: 12,
        marginTop: -8,
        marginBottom: 20,
      }}
    >
      <Feather name="info" size={14} color="#767676" style={{ marginTop: 2 }} />
      <Text className="font-ui text-text-secondary flex-1 ml-2" style={{ fontSize: 12.5 }}>
        Set a minimum skill rating if you want players with a certain skill level to join.
      </Text>
    </View>
  );
}

// ---- Team logo picker ---------------------------------------------------

export function TeamLogoPicker({
  uri,
  uploading,
  onPress,
}: {
  uri: string | null;
  uploading: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <View className="mb-2" testID="team-logo-field">
      <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
        Team Logo (Optional)
      </Text>
      <View className="flex-row items-center">
        <MotiView
          animate={{ scale: pressed ? 0.96 : 1 }}
          transition={{ type: 'timing', duration: 150 }}
        >
          <Pressable
            onPress={onPress}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            testID="team-logo-picker"
            accessibilityRole="button"
            accessibilityLabel="Add a team logo"
            className="items-center justify-center"
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: '#FAFAFA',
              borderWidth: uri ? 1.5 : 1,
              borderColor: uri ? colors.brandRed : '#CFCFCF',
              borderStyle: uri ? 'solid' : 'dashed',
              overflow: 'hidden',
            }}
          >
            {uri ? (
              <Image source={{ uri }} style={{ width: 76, height: 76 }} resizeMode="cover" />
            ) : (
              <Feather name="camera" size={24} color="#9A9A9A" />
            )}
            {uploading ? (
              <View
                className="absolute inset-0 items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                testID="team-logo-uploading"
              >
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>
        </MotiView>

        <View className="flex-1 ml-4">
          <Text className="font-ui font-semibold text-ink-black" style={{ fontSize: 14 }}>
            {uri ? 'Logo added' : 'Add a team logo'}
          </Text>
          <Text className="font-ui text-text-secondary" style={{ fontSize: 12, marginTop: 2 }}>
            PNG, JPG or WEBP (Max 5MB)
          </Text>
          <Pressable
            onPress={onPress}
            testID="team-logo-upload-button"
            className="flex-row items-center self-start"
            style={{
              marginTop: 8,
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 8,
              paddingVertical: 6,
              paddingHorizontal: 12,
            }}
          >
            <Feather name="upload" size={13} color="#111111" style={{ marginRight: 6 }} />
            <Text className="font-ui font-semibold text-ink-black" style={{ fontSize: 12.5 }}>
              Upload Image
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---- Tip card before the CTA -------------------------------------------

export function TeamTipCard() {
  return (
    <View
      className="flex-row items-start"
      style={{
        backgroundColor: '#FDECEC',
        borderLeftWidth: 3,
        borderLeftColor: colors.brandRed,
        borderRadius: 10,
        padding: 14,
        marginTop: 4,
        marginBottom: 24,
      }}
    >
      <Feather name="zap" size={16} color={colors.brandRed} style={{ marginTop: 1 }} />
      <Text className="font-ui text-ink-black flex-1 ml-3" style={{ fontSize: 13, lineHeight: 19 }}>
        A good team name and logo helps attract more players!
      </Text>
    </View>
  );
}

// ---- Submit CTA ----------------------------------------------------------

export type SubmitState = 'idle' | 'submitting' | 'success';

const SUBMIT_LABEL: Record<SubmitState, string> = {
  idle: 'CREATE TEAM',
  submitting: 'CREATING...',
  success: 'TEAM CREATED',
};

export function CreateTeamSubmitButton({
  state,
  onPress,
  testID,
}: {
  state: SubmitState;
  onPress: () => void;
  testID: string;
}) {
  const [pressed, setPressed] = useState(false);
  const [sweep, setSweep] = useState(0);
  const busy = state !== 'idle';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 380, delay: 100 }}
    >
      <MotiView
        animate={{ scale: pressed ? 0.97 : 1 }}
        transition={{ type: 'timing', duration: 140 }}
      >
        <Pressable
          onPress={() => {
            if (busy) return;
            setPressed(true);
            setSweep((n) => n + 1);
            onPress();
          }}
          onPressOut={() => setPressed(false)}
          disabled={busy}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel="Create Team"
          className="flex-row items-center justify-center"
          style={{
            height: 56,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor:
              state === 'success' ? colors.brandRedDark : pressed ? '#F0180C' : '#E10600',
            opacity: state === 'submitting' ? 0.85 : 1,
          }}
        >
          {sweep > 0 && state === 'idle' && (
            <MotiView
              key={sweep}
              from={{ translateX: -120 }}
              animate={{ translateX: 460 }}
              transition={{ type: 'timing', duration: 420 }}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -10,
                bottom: -10,
                width: 70,
                backgroundColor: 'rgba(255,255,255,0.22)',
                transform: [{ skewX: '-20deg' }],
              }}
            />
          )}
          {state === 'submitting' ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginRight: 10 }} />
          ) : null}
          <Text
            className="font-ui font-bold text-white"
            style={{ fontSize: 16, letterSpacing: 0.8 }}
          >
            {SUBMIT_LABEL[state]}
          </Text>
          {state === 'idle' ? (
            <MotiView
              animate={{ translateX: pressed ? 5 : 0 }}
              transition={{ type: 'timing', duration: 160 }}
              style={{ marginLeft: 10 }}
            >
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
            </MotiView>
          ) : null}
          {state === 'success' ? (
            <Feather name="check" size={20} color="#FFFFFF" style={{ marginLeft: 10 }} />
          ) : null}
        </Pressable>
      </MotiView>
    </MotiView>
  );
}
