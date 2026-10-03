import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BallLoader } from '../BallLoader';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { colors } from '../../theme/tokens';
import { CountUp } from './CountUp';
import { CricketBatIcon } from '../CricketBatIcon';

// The four Home shortcuts, laid out two by two: every card is the same size with the icon
// beside a one-line name and caption, so nothing wraps or misaligns however narrow the
// phone (the old four-across row wrapped "Create Team" and "BUILD SQUAD" onto two lines
// and the cards looked uneven). Tactile press: the card lifts 3px and the icon swells a
// touch, on a spring with no overshoot to speak of - subtle, not bouncy.
export function QuickAction({
  icon,
  label,
  caption,
  onPress,
  loading,
  testID,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  caption: string;
  onPress: () => void;
  loading?: boolean;
  testID: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <MotiView
      animate={{ translateY: pressed ? -3 : 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      style={{ width: '50%', paddingHorizontal: 4, marginBottom: 8 }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={loading}
        className="flex-row items-center bg-surface border border-border-subtle"
        style={{
          borderRadius: 14,
          height: 76,
          paddingHorizontal: 12,
          shadowColor: '#000',
          shadowOpacity: pressed ? 0.1 : 0.04,
          shadowRadius: pressed ? 14 : 8,
          shadowOffset: { width: 0, height: pressed ? 6 : 2 },
          elevation: pressed ? 3 : 1,
        }}
        testID={testID}
      >
        <View style={{ width: 34, alignItems: 'center' }}>
          {loading ? (
            <BallLoader size="small" />
          ) : (
            <MotiView
              animate={{ scale: pressed ? 1.1 : 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 320 }}
            >
              <Feather name={icon} size={26} color={colors.brandRed} />
            </MotiView>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            className="font-ui font-bold text-ink-black"
            style={{ fontSize: 14 }}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            className="font-ui text-text-tertiary"
            style={{ fontSize: 9, letterSpacing: 0.8, marginTop: 3 }}
            numberOfLines={1}
          >
            {caption}
          </Text>
        </View>
      </Pressable>
    </MotiView>
  );
}

type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function Stat({
  icon,
  value,
  label,
}: {
  // Either a MaterialCommunityIcons glyph name, or a custom icon element for
  // the cases MCI has no good match for (e.g. no cricket-bat glyph — only
  // baseball-bat — see CricketBatIcon).
  icon: MciName | React.ReactElement;
  value: number;
  label: string;
}) {
  return (
    <View className="flex-1 items-center">
      {typeof icon === 'string' ? (
        <MaterialCommunityIcons name={icon} size={22} color={colors.inkBlack} />
      ) : (
        icon
      )}
      <CountUp
        value={value}
        className="font-display text-brand-red"
        style={{ fontSize: 34, lineHeight: 40, marginTop: 8 }}
      />
      <Text className="font-ui text-ink-black" style={{ fontSize: 12, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export function PerformanceCard({
  matches,
  runs,
  wickets,
  streak,
  onViewDetails,
}: {
  matches: number;
  runs: number;
  wickets: number;
  streak: number;
  onViewDetails: () => void;
}) {
  const divider = <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#EEEDEE' }} />;
  return (
    <View
      className="bg-surface border border-border-subtle mt-6"
      style={{
        borderRadius: 14,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
      }}
      testID="home-performance-card"
    >
      <View className="flex-row items-center justify-between" style={{ marginBottom: 16 }}>
        <View className="flex-row items-center" style={{ flexShrink: 1, marginRight: 8 }}>
          <View className="bg-brand-red" style={{ width: 3, height: 14, marginRight: 8 }} />
          <Text
            className="font-ui font-bold text-ink-black"
            style={{ fontSize: 11, letterSpacing: 0.8 }}
            numberOfLines={1}
          >
            YOUR PERFORMANCE
          </Text>
        </View>
        <Pressable
          onPress={onViewDetails}
          hitSlop={8}
          className="flex-row items-center"
          testID="home-view-details"
        >
          <Text className="font-ui font-semibold text-ink-black" style={{ fontSize: 12 }}>
            View Details
          </Text>
          <Feather name="chevron-right" size={16} color={colors.inkBlack} />
        </Pressable>
      </View>
      <View className="flex-row">
        <Stat icon="cricket" value={matches} label="Matches" />
        {divider}
        <Stat
          icon={<CricketBatIcon size={22} color={colors.inkBlack} />}
          value={runs}
          label="Runs"
        />
        {divider}
        <Stat icon="view-column" value={wickets} label="Wickets" />
        {divider}
        <Stat icon="fire" value={streak} label="Streak" />
      </View>
    </View>
  );
}

// Slow opacity pulse (0.7 -> 1 -> 0.7) — noticeable but never nagging.
export function NotificationDot() {
  return (
    <MotiView
      from={{ opacity: 0.7 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 1300, loop: true, repeatReverse: true }}
      style={{
        position: 'absolute',
        width: 10,
        height: 10,
        top: -2,
        right: -2,
        borderRadius: 5,
        backgroundColor: colors.brandRed,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
      }}
    />
  );
}
