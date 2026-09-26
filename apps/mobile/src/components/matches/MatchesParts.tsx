import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import type { MyMatch } from '@bfam/shared-types';
import { colors } from '../../theme/tokens';
import { Reveal } from '../Reveal';

export interface LiveScoreSummary {
  runs: number;
  wickets: number;
  overs: number;
}

// Status labels are kept as-is (Open / Pending / Confirmed / Live /
// Completed / Cancelled) — they carry real information (an OPEN roster and
// a CONFIRMED one are different states), so the "upcoming" family is
// distinguished by treatment (red outline), not collapsed into one word.
const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'Live',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

// Red for anything still to come, solid red for live, neutral grey for
// closed states, muted for cancelled — never green.
export function StatusPill({ status, testID }: { status: string; testID?: string }) {
  const label = statusLabel(status).toUpperCase();
  let box: { backgroundColor: string; borderColor: string };
  let color: string;
  if (status === 'IN_PROGRESS') {
    box = { backgroundColor: colors.brandRed, borderColor: colors.brandRed };
    color = '#FFFFFF';
  } else if (status === 'COMPLETED') {
    box = { backgroundColor: '#F1F1F1', borderColor: '#F1F1F1' };
    color = '#555555';
  } else if (status === 'CANCELLED') {
    box = { backgroundColor: '#F6F6F6', borderColor: '#F6F6F6' };
    color = '#9A9A9A';
  } else {
    box = { backgroundColor: '#FFF5F5', borderColor: colors.brandRed };
    color = colors.brandRed;
  }
  return (
    <View
      style={{
        ...box,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
      testID={testID}
    >
      <Text style={{ color, fontSize: 10, letterSpacing: 1, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

// Slow pulse (1 -> 0.35 -> 1); a soft fade, never a flash.
export function LiveDot({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <MotiView
      from={{ opacity: 1 }}
      animate={{ opacity: 0.35 }}
      transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }}
    />
  );
}

// Large action panel: white, thin red border, arrow that nudges right and a
// border that strengthens on press.
export function FindRoomPanel({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Reveal delay={200}>
      <MotiView
        animate={{ scale: pressed ? 0.98 : 1 }}
        transition={{ type: 'timing', duration: 160 }}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          testID="find-a-room-button"
          accessibilityRole="button"
          accessibilityLabel="Find a room"
          className="flex-row items-center"
          style={{
            backgroundColor: pressed ? '#FFF1F1' : '#FFFDFD',
            borderWidth: pressed ? 1.5 : 1,
            borderColor: colors.brandRed,
            borderRadius: 12,
            paddingVertical: 18,
            paddingHorizontal: 16,
            shadowColor: colors.brandRed,
            shadowOpacity: pressed ? 0.14 : 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View
            className="items-center justify-center"
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FDECEC' }}
          >
            <Feather name="users" size={24} color={colors.brandRed} />
          </View>
          <View className="flex-1" style={{ marginLeft: 16 }}>
            <Text
              className="font-ui font-bold text-ink-black"
              style={{ fontSize: 18, letterSpacing: 0.6 }}
            >
              FIND A ROOM
            </Text>
            <Text className="font-ui text-text-secondary" style={{ fontSize: 13, marginTop: 3 }}>
              Join open matches and play now.
            </Text>
          </View>
          <MotiView
            animate={{ translateX: pressed ? 6 : 0 }}
            transition={{ type: 'timing', duration: 180 }}
          >
            <Feather name="arrow-right" size={24} color={colors.brandRed} />
          </MotiView>
        </Pressable>
      </MotiView>
    </Reveal>
  );
}

function formatMatchTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function venueLine(match: MyMatch): string | null {
  const parts = [match.turf_name, match.city].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// One match row. Cards enter in a light stagger (index-based delay) and give
// press feedback with a tiny scale — nothing bounces.
export function MatchCard({
  match,
  index,
  live,
  onPress,
  onWatchLive,
}: {
  match: MyMatch;
  index: number;
  live: LiveScoreSummary | null;
  onPress: () => void;
  onWatchLive: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const isLive = match.match_status === 'IN_PROGRESS';
  const title = match.match_name ?? `${match.match_type} match`;
  const venue = venueLine(match);

  return (
    <Reveal delay={260 + Math.min(index, 5) * 70}>
      <MotiView
        animate={{ scale: pressed ? 0.985 : 1 }}
        transition={{ type: 'timing', duration: 150 }}
        style={{ marginBottom: 14 }}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          testID={`my-match-row-${match.match_id}`}
          accessibilityRole="button"
          style={
            isLive
              ? {
                  backgroundColor: colors.brandRed,
                  borderRadius: 14,
                  padding: 18,
                }
              : {
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#EEEDEE',
                  padding: 16,
                  shadowColor: '#000',
                  shadowOpacity: pressed ? 0.09 : 0.04,
                  shadowRadius: pressed ? 14 : 10,
                  shadowOffset: { width: 0, height: pressed ? 5 : 2 },
                }
          }
        >
          {isLive ? (
            <>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <LiveDot />
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '700',
                      letterSpacing: 1.4,
                    }}
                  >
                    LIVE
                  </Text>
                </View>
                <StatusPill status="IN_PROGRESS" testID={`match-status-${match.match_id}`} />
              </View>
              <Text
                className="font-ui font-bold"
                style={{ color: '#FFFFFF', fontSize: 18, marginTop: 10 }}
                numberOfLines={1}
              >
                {title}
              </Text>
              {live && (
                <View className="flex-row items-end justify-between" style={{ marginTop: 6 }}>
                  <Text
                    className="font-display"
                    style={{ color: '#FFFFFF', fontSize: 40, lineHeight: 46 }}
                  >
                    {live.runs} / {live.wickets}
                  </Text>
                  <Text
                    style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 1.2 }}
                  >
                    {live.overs.toFixed(1)} OVERS
                  </Text>
                </View>
              )}
              <Pressable
                onPress={onWatchLive}
                hitSlop={8}
                testID={`watch-live-${match.match_id}`}
                className="flex-row items-center"
                style={{ marginTop: 10 }}
              >
                <Text
                  style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}
                >
                  WATCH LIVE
                </Text>
                <Feather name="chevron-right" size={16} color="#FFFFFF" />
              </Pressable>
            </>
          ) : (
            <View className="flex-row items-center">
              <View
                className="items-center justify-center"
                style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FDECEC' }}
              >
                <MaterialCommunityIcons name="cricket" size={22} color={colors.brandRed} />
              </View>
              <View className="flex-1" style={{ marginLeft: 14, marginRight: 8 }}>
                <Text
                  className="font-ui font-bold text-ink-black"
                  style={{ fontSize: 17 }}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                <View className="flex-row items-center" style={{ marginTop: 6 }}>
                  <Feather name="calendar" size={13} color="#666666" />
                  <Text
                    className="font-ui text-text-secondary"
                    style={{ fontSize: 13, marginLeft: 6 }}
                  >
                    {formatMatchTime(match.scheduled_start_time)}
                  </Text>
                </View>
                {venue && (
                  <View className="flex-row items-center" style={{ marginTop: 4 }}>
                    <Feather name="map-pin" size={13} color="#666666" />
                    <Text
                      className="font-ui text-text-secondary"
                      style={{ fontSize: 13, marginLeft: 6, flexShrink: 1 }}
                      numberOfLines={1}
                    >
                      {venue}
                    </Text>
                  </View>
                )}
              </View>
              <View
                className="items-end justify-between"
                style={{ alignSelf: 'stretch', minHeight: 52 }}
              >
                <StatusPill status={match.match_status} testID={`match-status-${match.match_id}`} />
                <Feather
                  name="chevron-right"
                  size={20}
                  color={colors.inkBlack}
                  style={{ marginTop: 10 }}
                />
              </View>
            </View>
          )}
        </Pressable>
      </MotiView>
    </Reveal>
  );
}
