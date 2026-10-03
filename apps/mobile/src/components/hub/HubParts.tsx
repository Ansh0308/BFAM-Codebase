import React from 'react';
import { Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { BallLoader } from '../BallLoader';

// Shared look for the player's "progress" screens (Statistics, Leaderboards, Level & XP,
// Achievements, Rewards, Recognition, Membership, Refer a Friend, Match Streaks): a BFAM-red
// header band, a white rounded sheet that overlaps it, and white cards with a red icon badge
// - the same card language as the Home shortcuts. One place so the nine screens stay alike.

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const RED_TINT = '#FDECEC';

export const cardShadow: ViewStyle = {
  shadowColor: '#000',
  shadowOpacity: 0.04,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};

// ---- Screen: red header + white sheet -----------------------------------

export function HubScreen({
  title,
  subtitle,
  backTestID,
  testID,
  controls,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: string;
  backTestID: string;
  // testID of the scrolling content (the screens' tests and e2e hooks look for it).
  testID: string;
  // Fixed controls shown above the scrolling content (tabs, month picker...).
  controls?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View className="flex-1 bg-surface">
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.brandRed, colors.brandRedDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 38 }}
      >
        <SafeAreaView edges={['top']}>
          <View className="flex-row items-center px-5 pt-4">
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back"
              testID={backTestID}
            >
              <Feather name="arrow-left" size={22} color="#FFFFFF" />
            </Pressable>
            <View className="flex-1 ml-3">
              <Text
                className="font-ui font-bold"
                style={{ fontSize: 22, color: '#FFFFFF' }}
                numberOfLines={1}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  className="font-ui"
                  style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 2 }}
                  numberOfLines={2}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {headerRight}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View
        style={{
          flex: 1,
          marginTop: -24,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        }}
      >
        {controls ? <View style={{ paddingTop: 16, paddingBottom: 4 }}>{controls}</View> : null}
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: controls ? 10 : 20, paddingBottom: 48 }}
          testID={testID}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

// ---- Cards and badges ----------------------------------------------------

export function HubCard({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View
      className="bg-surface border border-border-subtle"
      style={[{ borderRadius: 14, padding: 14, marginBottom: 12 }, cardShadow, style]}
      testID={testID}
    >
      {children}
    </View>
  );
}

export function IconBadge({
  icon,
  size = 40,
  tone = 'red',
}: {
  icon: IconName;
  size?: number;
  tone?: 'red' | 'solid' | 'muted';
}) {
  const bg = tone === 'solid' ? colors.brandRed : tone === 'muted' ? '#F1F1F1' : RED_TINT;
  const fg =
    tone === 'solid' ? '#FFFFFF' : tone === 'muted' ? colors.textTertiary : colors.brandRed;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.52)} color={fg} />
    </View>
  );
}

// Red gradient panel for the one headline figure on a screen.
export function HeroCard({
  children,
  testID,
  style,
}: {
  children: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={[colors.brandRed, colors.brandRedDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: 18, padding: 18, marginBottom: 16 }, style]}
      testID={testID}
    >
      {children}
    </LinearGradient>
  );
}

export function StatTile({
  icon,
  label,
  value,
  testID,
}: {
  icon: IconName;
  label: string;
  value: string;
  testID?: string;
}) {
  return (
    <View style={{ width: '50%', paddingHorizontal: 5 }} testID={testID}>
      <HubCard style={{ minHeight: 112 }}>
        <IconBadge icon={icon} size={34} />
        <Text
          className="font-ui text-text-tertiary"
          style={{ fontSize: 10, letterSpacing: 0.8, marginTop: 10 }}
          numberOfLines={1}
        >
          {label.toUpperCase()}
        </Text>
        <Text
          className="font-display text-ink-black"
          style={{ fontSize: 28, lineHeight: 34, marginTop: 2 }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </HubCard>
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row items-center" style={{ marginTop: 8, marginBottom: 10 }}>
      <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: colors.brandRed }} />
      <Text
        className="font-ui font-bold text-text-secondary"
        style={{ fontSize: 11, letterSpacing: 1, marginLeft: 8 }}
      >
        {String(children).toUpperCase()}
      </Text>
    </View>
  );
}

export function Chip({
  text,
  tone = 'red',
  testID,
}: {
  text: string;
  tone?: 'red' | 'solid' | 'muted';
  testID?: string;
}) {
  const bg = tone === 'solid' ? colors.brandRed : tone === 'muted' ? '#F1F1F1' : RED_TINT;
  const fg =
    tone === 'solid' ? '#FFFFFF' : tone === 'muted' ? colors.textTertiary : colors.brandRed;
  return (
    <View
      style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}
      testID={testID}
    >
      <Text className="font-ui font-bold" style={{ fontSize: 11, color: fg, letterSpacing: 0.4 }}>
        {text}
      </Text>
    </View>
  );
}

export function ProgressBar({
  percent,
  onDark,
  testID,
}: {
  percent: number;
  onDark?: boolean;
  testID?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View
      style={{
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
        backgroundColor: onDark ? 'rgba(255,255,255,0.28)' : '#F1F1F1',
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: 10,
          borderRadius: 5,
          backgroundColor: onDark ? '#FFFFFF' : colors.brandRed,
        }}
        testID={testID}
      />
    </View>
  );
}

// ---- Buttons, tabs, states ------------------------------------------------

export function PillButton({
  label,
  onPress,
  disabled,
  variant = 'solid',
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
  icon?: React.ComponentProps<typeof Feather>['name'];
  testID?: string;
}) {
  const solid = variant === 'solid';
  const fg = disabled ? colors.textTertiary : solid ? '#FFFFFF' : colors.brandRed;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      testID={testID}
      className="flex-row items-center justify-center"
      style={{
        height: 38,
        paddingHorizontal: 18,
        borderRadius: 999,
        backgroundColor: disabled ? '#F1F1F1' : solid ? colors.brandRed : '#FFFFFF',
        borderWidth: solid && !disabled ? 0 : 1.5,
        borderColor: disabled ? '#E4E4E4' : colors.brandRed,
      }}
    >
      {icon ? <Feather name={icon} size={15} color={fg} style={{ marginRight: 6 }} /> : null}
      <Text className="font-ui font-bold" style={{ fontSize: 13, letterSpacing: 0.6, color: fg }}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  testIDPrefix,
  scroll,
  containerTestID,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testIDPrefix: string;
  scroll?: boolean;
  containerTestID?: string;
}) {
  const pills = items.map((item) => {
    const selected = item.value === value;
    return (
      <Pressable
        key={item.value}
        onPress={() => onChange(item.value)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        testID={`${testIDPrefix}-${item.value}`}
        className="items-center justify-center"
        style={{
          flex: scroll ? undefined : 1,
          height: 38,
          paddingHorizontal: 18,
          marginRight: 8,
          borderRadius: 999,
          backgroundColor: selected ? colors.brandRed : '#FFFFFF',
          borderWidth: 1,
          borderColor: selected ? colors.brandRed : colors.borderStrong,
        }}
      >
        <Text
          className="font-ui font-bold"
          style={{ fontSize: 13, color: selected ? '#FFFFFF' : colors.textPrimary }}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        testID={containerTestID}
      >
        {pills}
      </ScrollView>
    );
  }
  return (
    <View className="flex-row px-5" testID={containerTestID}>
      {pills}
    </View>
  );
}

export function HubLoading({ testID }: { testID: string }) {
  return (
    <View className="py-10 items-center">
      <BallLoader testID={testID} />
    </View>
  );
}

export function HubMessage({
  children,
  tone = 'muted',
  icon,
  testID,
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'error' | 'ok';
  icon?: IconName;
  testID?: string;
}) {
  const color =
    tone === 'error' ? colors.brandRed : tone === 'ok' ? colors.inkBlack : colors.textTertiary;
  return (
    <View className="items-center" style={{ paddingVertical: 20 }} testID={testID}>
      {icon ? (
        <View style={{ marginBottom: 10 }}>
          <IconBadge icon={icon} size={52} tone="muted" />
        </View>
      ) : null}
      <Text className="font-ui text-body text-center" style={{ color }}>
        {children}
      </Text>
    </View>
  );
}
