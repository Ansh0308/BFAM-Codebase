import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Reveal } from '../Reveal';
import { CountUp } from '../home/CountUp';
import { CricketBallIcon } from '../CricketBallIcon';
import { CricketBatIcon } from '../CricketBatIcon';

const RED = '#E10600';

// ---- Section title: display type + short red underline ----------------

export function SectionTitle({
  title,
  subtitle,
  testID,
}: {
  title: string;
  subtitle?: string;
  testID?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }} testID={testID}>
      <Text className="font-display text-ink-black" style={{ fontSize: 24, lineHeight: 28 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="font-ui text-text-secondary" style={{ fontSize: 12.5, marginTop: 2 }}>
          {subtitle}
        </Text>
      ) : null}
      <MotiView
        from={{ width: 0 }}
        animate={{ width: 36 }}
        transition={{ type: 'timing', duration: 450, delay: 150 }}
        style={{ height: 3, borderRadius: 2, backgroundColor: RED, marginTop: 8 }}
      />
    </View>
  );
}

// ---- Avatar with the BFAM-red ring -------------------------------------

export function RingFrame({ size, children }: { size: number; children: React.ReactNode }) {
  const outer = size + 14;
  return (
    <MotiView
      from={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      transition={{ type: 'timing', duration: 600 }}
      style={{
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        borderWidth: 3,
        borderColor: RED,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: RED,
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      {children}
    </MotiView>
  );
}

// ---- Follower stat -------------------------------------------------------

export function FollowStat({ value, label }: { value: number; label: string }) {
  return (
    <View className="items-center" style={{ minWidth: 96 }}>
      <CountUp
        value={value}
        className="font-display text-ink-black"
        style={{ fontSize: 30, lineHeight: 34 }}
      />
      <Text className="font-ui text-text-secondary" style={{ fontSize: 13 }}>
        {label}
      </Text>
    </View>
  );
}

// ---- Edit profile button ------------------------------------------------

export function EditProfileButton({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <MotiView
      animate={{ scale: pressed ? 0.97 : 1 }}
      transition={{ type: 'timing', duration: 150 }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        testID="edit-profile-button"
        accessibilityRole="button"
        className="flex-row items-center justify-center"
        style={{
          height: 44,
          paddingHorizontal: 26,
          borderRadius: 10,
          backgroundColor: '#FFFFFF',
          borderWidth: pressed ? 2 : 1.5,
          borderColor: RED,
        }}
      >
        <MotiView
          animate={{ translateX: pressed ? 2 : 0 }}
          transition={{ type: 'timing', duration: 150 }}
        >
          <Feather name="edit-2" size={15} color={RED} />
        </MotiView>
        <Text
          className="font-ui font-bold"
          style={{ fontSize: 14, letterSpacing: 1, color: RED, marginLeft: 8 }}
        >
          EDIT PROFILE
        </Text>
      </Pressable>
    </MotiView>
  );
}

// ---- Favourite cricketer: editorial strip -------------------------------

export function FavoriteCricketerCard({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <Reveal delay={80} distance={10} duration={500}>
      <View
        testID="favorite-cricketer-card"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#E8E8E8',
          overflow: 'hidden',
          minHeight: 92,
          justifyContent: 'center',
          paddingHorizontal: 16,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        {/* Red strokes + a ghosted initial on the right, in place of a
            portrait — there is no photo for an arbitrary cricketer name. */}
        <MotiView
          from={{ translateX: 40, opacity: 0 }}
          animate={{ translateX: 0, opacity: 1 }}
          transition={{ type: 'timing', duration: 650, delay: 150 }}
          pointerEvents="none"
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 150 }}
        >
          <View
            style={{
              position: 'absolute',
              right: -30,
              top: -20,
              width: 46,
              height: 150,
              backgroundColor: RED,
              opacity: 0.85,
              transform: [{ rotate: '24deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 36,
              top: -20,
              width: 12,
              height: 150,
              backgroundColor: RED,
              opacity: 0.35,
              transform: [{ rotate: '24deg' }],
            }}
          />
          <Text
            className="font-display"
            style={{
              position: 'absolute',
              right: 52,
              top: 4,
              fontSize: 84,
              color: '#111111',
              opacity: 0.08,
            }}
          >
            {initial}
          </Text>
        </MotiView>
        <View className="flex-row items-center" style={{ paddingRight: 90 }}>
          <View
            className="items-center justify-center"
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FDECEC' }}
          >
            <Feather name="star" size={17} color={RED} />
          </View>
          <View className="ml-3 flex-1">
            <Text
              className="font-ui text-text-secondary uppercase"
              style={{ fontSize: 10.5, letterSpacing: 1.4 }}
            >
              Favorite Cricketer
            </Text>
            <Text
              className="font-ui font-bold text-ink-black"
              style={{ fontSize: 19, marginTop: 2 }}
              numberOfLines={1}
            >
              {name}
            </Text>
          </View>
        </View>
      </View>
    </Reveal>
  );
}

// ---- Player detail tile (2 x 2 grid) -------------------------------------

export type DetailIcon = 'bat' | 'helmet' | 'ball' | 'bars';

function DetailGlyph({ icon }: { icon: DetailIcon }) {
  if (icon === 'bat') return <CricketBatIcon size={26} color={RED} />;
  if (icon === 'ball') return <CricketBallIcon size={24} color={RED} showStitches />;
  if (icon === 'helmet') return <MaterialCommunityIcons name="hard-hat" size={25} color={RED} />;
  return <Feather name="bar-chart-2" size={22} color={RED} />;
}

export function PlayerDetailTile({
  label,
  value,
  icon,
  index,
}: {
  label: string;
  value: string;
  icon: DetailIcon;
  index: number;
}) {
  return (
    <View style={{ width: '50%', paddingHorizontal: 5, marginBottom: 10 }}>
      <Reveal delay={index * 60} distance={8} duration={380}>
        <View
          className="flex-row items-center"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 11,
            borderWidth: 1,
            borderColor: '#E8E8E8',
            paddingVertical: 14,
            paddingHorizontal: 12,
            minHeight: 74,
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <View style={{ width: 28, alignItems: 'center', marginRight: 8 }}>
            <DetailGlyph icon={icon} />
          </View>
          <View className="flex-1">
            <Text
              className="font-ui text-text-secondary uppercase"
              style={{ fontSize: 9.5, letterSpacing: 1 }}
              numberOfLines={1}
            >
              {label}
            </Text>
            <Text
              className="font-ui font-bold text-ink-black"
              style={{ fontSize: 14.5, marginTop: 2 }}
              numberOfLines={1}
            >
              {value}
            </Text>
          </View>
        </View>
      </Reveal>
    </View>
  );
}

// ---- Athlete Hub card ------------------------------------------------------

export function HubCard({
  icon,
  title,
  description,
  onPress,
  index,
  testID,
  fullWidth,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description: string;
  onPress: () => void;
  index: number;
  testID: string;
  fullWidth?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <View style={{ width: fullWidth ? '100%' : '50%', paddingHorizontal: 5, marginBottom: 10 }}>
      <Reveal delay={index * 55} distance={10} duration={380}>
        <MotiView
          animate={{ translateY: pressed ? -2 : 0, scale: pressed ? 0.985 : 1 }}
          transition={{ type: 'timing', duration: 170 }}
        >
          <Pressable
            onPress={onPress}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            testID={testID}
            accessibilityRole="button"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E8E8E8',
              padding: 14,
              minHeight: 100,
              shadowColor: '#000',
              shadowOpacity: pressed ? 0.09 : 0.04,
              shadowRadius: pressed ? 14 : 10,
              shadowOffset: { width: 0, height: pressed ? 6 : 3 },
            }}
          >
            <View className="flex-row items-center justify-between">
              <Feather name={icon} size={22} color={RED} />
              <MotiView
                animate={{ translateX: pressed ? 3 : 0 }}
                transition={{ type: 'timing', duration: 160 }}
              >
                <Feather name="arrow-right" size={15} color="#111111" />
              </MotiView>
            </View>
            <Text
              className="font-ui font-bold text-ink-black"
              style={{ fontSize: 14.5, marginTop: 10 }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              className="font-ui text-text-secondary"
              style={{ fontSize: 11.5, lineHeight: 16, marginTop: 3 }}
              numberOfLines={2}
            >
              {description}
            </Text>
          </Pressable>
        </MotiView>
      </Reveal>
    </View>
  );
}

// ---- Basic skill rating ------------------------------------------------------

// The rating is an open-ended number (default 500), so the bar is a simple
// visual cue against a 0-1000 scale rather than a precise percentage.
const RATING_SCALE = 1000;

export function SkillRatingCard({ rating }: { rating: number }) {
  const pct = Math.max(4, Math.min(100, (rating / RATING_SCALE) * 100));
  return (
    <Reveal delay={60} distance={10} duration={420}>
      <View
        testID="ratings-section"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#E8E8E8',
          padding: 18,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Text
          className="font-ui text-text-secondary uppercase"
          style={{ fontSize: 11, letterSpacing: 1.6 }}
        >
          Basic Skill Rating
        </Text>
        <View className="flex-row items-end" style={{ marginTop: 4 }}>
          <CountUp
            value={rating}
            duration={1200}
            className="font-display"
            style={{ fontSize: 56, lineHeight: 60, color: RED }}
            testID="skill-rating-value"
          />
          <Text
            className="font-ui text-text-tertiary"
            style={{ fontSize: 12, marginLeft: 8, marginBottom: 12 }}
          >
            / {RATING_SCALE}
          </Text>
        </View>
        <View
          style={{ height: 6, borderRadius: 3, backgroundColor: '#F0F0F0', overflow: 'hidden' }}
        >
          <MotiView
            from={{ width: '0%' }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'timing', duration: 1200 }}
            style={{ height: 6, borderRadius: 3, backgroundColor: RED }}
          />
        </View>
        <Text
          className="font-ui text-text-secondary"
          style={{ fontSize: 12.5, lineHeight: 18, marginTop: 10 }}
        >
          Fair Play, Reliability, and Community Rating — coming in a later module.
        </Text>
      </View>
    </Reveal>
  );
}
