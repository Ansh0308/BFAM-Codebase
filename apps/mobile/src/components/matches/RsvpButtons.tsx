import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';

export type Rsvp = 'CONFIRMED' | 'MAYBE' | 'CANT_PLAY';

const OPTIONS: {
  value: Rsvp;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  testID: string;
  primary?: boolean;
}[] = [
  {
    value: 'CONFIRMED',
    label: 'Confirm',
    icon: 'check',
    testID: 'respond-confirmed',
    primary: true,
  },
  { value: 'MAYBE', label: 'Maybe', icon: 'help-circle', testID: 'respond-maybe' },
  { value: 'CANT_PLAY', label: "Can't play", icon: 'x', testID: 'respond-cant-play' },
];

// The three answers to a match invite, side by side. Each is an equal-width tile with the icon
// above a one-line label, so "Confirm", "Maybe" and "Can't play" fit whole on any phone width -
// the shared Button's padding and capitals broke them mid-word ("CONFI/RM", "MAYB/E") at a third
// of the screen each.
export function RsvpButtons({
  onRespond,
  busy,
}: {
  onRespond: (value: Rsvp) => void;
  busy: boolean;
}) {
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {OPTIONS.map((o) => {
        const fg = o.primary ? '#FFFFFF' : colors.inkBlack;
        return (
          <Pressable
            key={o.value}
            onPress={() => onRespond(o.value)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ disabled: busy }}
            testID={o.testID}
            style={{
              flex: 1,
              minWidth: 0,
              height: 62,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
              backgroundColor: o.primary ? colors.brandRed : colors.surface,
              borderWidth: o.primary ? 0 : 1.5,
              borderColor: colors.borderStrong,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Feather name={o.icon} size={18} color={o.primary ? fg : colors.brandRed} />
            <Text
              className="font-ui font-bold"
              style={{ fontSize: 13, color: fg, marginTop: 4 }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
