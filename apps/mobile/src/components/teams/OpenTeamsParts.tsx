import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import type { MyTeam, OpenTeam } from '@bfam/shared-types';
import { colors } from '../../theme/tokens';
import { Reveal } from '../Reveal';

// ---- City filter ---------------------------------------------------------
//
// A tap-to-expand picker (same technique as DateOfBirthField — an in-flow
// expanding card, not RN's Modal, which doesn't composite reliably on web)
// over the options actually present in the current unfiltered result set,
// rather than a fixed, possibly-stale city list.
export function CityFilterField({
  value,
  options,
  onChange,
  testID = 'open-teams-city-filter',
}: {
  value: string;
  options: string[];
  onChange: (city: string) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ position: 'relative', zIndex: open ? 50 : 1, marginBottom: 18 }} testID={testID}>
      <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
        City
      </Text>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        testID={`${testID}-trigger`}
        accessibilityRole="button"
        className="flex-row items-center justify-between bg-surface rounded-md border px-4"
        style={{
          height: 50,
          borderWidth: open ? 1.5 : 1,
          borderColor: open ? colors.brandRed : '#E8E8E8',
          borderRadius: 11,
        }}
      >
        <View className="flex-row items-center">
          <Feather name="map-pin" size={16} color={open ? colors.brandRed : '#767676'} />
          <Text
            className={
              value
                ? 'font-ui text-body text-text-primary ml-3'
                : 'font-ui text-body text-text-tertiary ml-3'
            }
          >
            {value || 'Filter by city'}
          </Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#767676" />
      </Pressable>

      {open && (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E8E8E8',
            borderRadius: 11,
            marginTop: 6,
            paddingVertical: 4,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
          }}
          testID={`${testID}-options`}
        >
          {options.length === 0 ? (
            <Text className="font-ui text-body text-text-tertiary px-4 py-3">
              No cities to filter by yet.
            </Text>
          ) : (
            options.map((city) => {
              const selected = city === value;
              return (
                <Pressable
                  key={city}
                  onPress={() => {
                    onChange(city);
                    setOpen(false);
                  }}
                  testID={`${testID}-option-${city}`}
                  className="flex-row items-center justify-between px-4"
                  style={{ height: 44 }}
                >
                  <Text
                    className="font-ui text-body"
                    style={{
                      color: selected ? colors.brandRed : '#111111',
                      fontWeight: selected ? '700' : '400',
                    }}
                  >
                    {city}
                  </Text>
                  {selected && <Feather name="check" size={16} color={colors.brandRed} />}
                </Pressable>
              );
            })
          )}
          {value ? (
            <Pressable
              onPress={() => {
                onChange('');
                setOpen(false);
              }}
              testID={`${testID}-clear`}
              className="px-4 border-t border-border-subtle"
              style={{ height: 44, justifyContent: 'center' }}
            >
              <Text className="font-ui font-semibold text-body text-text-secondary">
                Clear filter
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ---- Team card ------------------------------------------------------------

function TeamLogo({ team }: { team: OpenTeam }) {
  const size = 58;
  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#F2F2F2',
        overflow: 'hidden',
        marginRight: 14,
      }}
    >
      {team.team_logo_url ? (
        <Image
          source={{ uri: team.team_logo_url }}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      ) : (
        <MaterialCommunityIcons name="shield" size={26} color={colors.brandRed} />
      )}
    </View>
  );
}

// A small action button shared by both the Request to Join and Challenge
// CTAs — press animation (scale + arrow nudge) and a success state that
// swaps the label/icon instead of the button disappearing.
function TeamActionButton({
  label,
  doneLabel,
  done,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  doneLabel: string;
  done: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <MotiView
      animate={{ scale: pressed ? 0.97 : 1 }}
      transition={{ type: 'timing', duration: 150 }}
      style={{ marginTop: 10 }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={done || disabled}
        testID={testID}
        accessibilityRole="button"
        className="flex-row items-center justify-center"
        style={{
          height: 48,
          borderRadius: 9,
          backgroundColor: done ? '#F2F2F2' : pressed ? '#F0180C' : colors.brandRed,
        }}
      >
        <Feather
          name="users"
          size={15}
          color={done ? '#767676' : '#FFFFFF'}
          style={{ marginRight: 8 }}
        />
        <Text
          className="font-ui font-bold"
          style={{ fontSize: 14, letterSpacing: 0.6, color: done ? '#767676' : '#FFFFFF' }}
        >
          {done ? doneLabel : label}
        </Text>
        {!done && (
          <MotiView
            animate={{ translateX: pressed ? 4 : 0 }}
            transition={{ type: 'timing', duration: 150 }}
            style={{ marginLeft: 8 }}
          >
            <Feather name="arrow-right" size={15} color="#FFFFFF" />
          </MotiView>
        )}
        {done && <Feather name="check" size={15} color="#767676" style={{ marginLeft: 6 }} />}
      </Pressable>
    </MotiView>
  );
}

export function OpenTeamCard({
  team,
  index,
  mode,
  requested,
  onRequestToJoin,
  myCaptainedTeams,
  challengeSentIds,
  challengingTeamId,
  onChallenge,
  onPress,
}: {
  team: OpenTeam;
  index: number;
  mode: 'players' | 'challenge';
  requested: boolean;
  onRequestToJoin: () => void;
  myCaptainedTeams: MyTeam[];
  challengeSentIds: Set<string>;
  challengingTeamId: string | null;
  onChallenge: (myTeamId: string) => void;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const eligibleCaptainedTeams = myCaptainedTeams.filter((t) => t.team_id !== team.team_id);

  return (
    <Reveal delay={Math.min(index, 6) * 50} distance={10} duration={380}>
      <MotiView
        animate={{ translateY: pressed ? -2 : 0 }}
        transition={{ type: 'timing', duration: 180 }}
        style={{ marginBottom: 14 }}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          testID={`open-team-row-${team.team_id}`}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 13,
            borderWidth: 1,
            borderColor: '#E8E8E8',
            paddingVertical: 16,
            paddingRight: 16,
            paddingLeft: 20,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: pressed ? 0.08 : 0.04,
            shadowRadius: pressed ? 16 : 10,
            shadowOffset: { width: 0, height: pressed ? 5 : 2 },
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              backgroundColor: colors.brandRed,
            }}
          />

          <View className="flex-row items-center">
            <TeamLogo team={team} />
            <View className="flex-1">
              <View className="flex-row items-center" style={{ flexWrap: 'wrap' }}>
                <Text
                  className="font-ui font-bold text-ink-black"
                  style={{ fontSize: 17, marginRight: 8 }}
                  numberOfLines={1}
                >
                  {team.team_name}
                </Text>
                {/* Backlog B-5: Fair Play score — how evenly this team has
                    shared batting/bowling chances across its roster,
                    averaged from active members' reliability_score. Not
                    the player's own BFAM Points (Home's coin balance) —
                    labeled distinctly so the two aren't read as the same
                    thing. Hidden until the team has a computed score. */}
                {team.fair_play_score != null && (
                  <View
                    className="rounded-md bg-status-info-bg px-2 py-0.5 flex-row items-center"
                    testID={`fair-play-score-${team.team_id}`}
                  >
                    <Feather name="shield" size={10} color="#1D5DAD" />
                    <Text className="font-ui text-micro font-bold text-status-info ml-1">
                      {team.fair_play_score} Fair Play
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center" style={{ marginTop: 4 }}>
                <Feather name="map-pin" size={12} color={colors.brandRed} />
                <Text className="font-ui text-text-secondary ml-1" style={{ fontSize: 13 }}>
                  {team.home_city ?? 'City not set'}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center justify-between" style={{ marginTop: 14 }}>
            <View className="flex-row items-center">
              <Feather name="bar-chart-2" size={13} color={colors.brandRed} />
              <Text
                className="font-ui font-bold text-ink-black uppercase ml-1.5"
                style={{ fontSize: 12.5, letterSpacing: 0.4 }}
              >
                {team.skill_level ?? 'Any'}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Feather name="users" size={13} color={colors.brandRed} />
              <Text className="font-ui text-ink-black ml-1.5" style={{ fontSize: 13 }}>
                {team.active_member_count} {team.active_member_count === 1 ? 'Member' : 'Members'}
              </Text>
            </View>
          </View>

          {/* Backlog B-8: shown so a player knows the requirement before
              requesting, rather than only finding out from a rejected
              request. */}
          {team.min_skill_rating != null && (
            <Text
              className="font-ui text-text-tertiary"
              style={{ fontSize: 11.5, marginTop: 6 }}
              testID={`min-skill-rating-${team.team_id}`}
            >
              Requires {team.min_skill_rating}+ Skill Rating
            </Text>
          )}

          {mode === 'players' ? (
            <TeamActionButton
              label="Request to Join"
              doneLabel="Request Sent"
              done={requested}
              onPress={onRequestToJoin}
              testID={`request-to-join-${team.team_id}`}
            />
          ) : eligibleCaptainedTeams.length === 0 ? (
            <Text className="text-text-tertiary" style={{ fontSize: 12.5, marginTop: 12 }}>
              You need to captain a team to send a challenge.
            </Text>
          ) : (
            eligibleCaptainedTeams.map((myTeam) => (
              <TeamActionButton
                key={myTeam.team_id}
                label={`Challenge with ${myTeam.team_name}`}
                doneLabel="Challenge Sent"
                done={challengeSentIds.has(team.team_id)}
                disabled={challengingTeamId === myTeam.team_id}
                onPress={() => onChallenge(myTeam.team_id)}
                testID={`challenge-open-team-${team.team_id}-${myTeam.team_id}`}
              />
            ))
          )}
        </Pressable>
      </MotiView>
    </Reveal>
  );
}

// ---- Empty state ----------------------------------------------------------

export function EmptyOpenTeams({
  mode,
  onCreateTeam,
}: {
  mode: 'players' | 'challenge';
  onCreateTeam: () => void;
}) {
  return (
    <View className="items-center" style={{ marginTop: 32 }} testID="open-teams-empty">
      <MotiView
        from={{ opacity: 0, translateY: 14 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 600 }}
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: '#F2F2F2',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="users" size={30} color="#9A9A9A" />
      </MotiView>
      <MotiView
        from={{ width: 0 }}
        animate={{ width: 44 }}
        transition={{ type: 'timing', duration: 500, delay: 300 }}
        style={{ height: 3, borderRadius: 2, backgroundColor: colors.brandRed, marginTop: 18 }}
      />
      <Reveal delay={400}>
        <Text
          className="font-display text-ink-black text-center"
          style={{ fontSize: 24, marginTop: 14 }}
        >
          NO OPEN TEAMS
        </Text>
        <Text
          className="font-ui text-text-secondary text-center"
          style={{ fontSize: 14, marginTop: 8, maxWidth: 260 }}
        >
          {mode === 'challenge'
            ? 'No teams are currently open for a challenge in this area.'
            : 'No teams are currently looking for players in this area.'}
        </Text>
      </Reveal>
      <Reveal delay={550}>
        <Pressable
          onPress={onCreateTeam}
          testID="open-teams-empty-create-team"
          className="flex-row items-center justify-center"
          style={{
            height: 50,
            borderRadius: 11,
            backgroundColor: colors.brandRed,
            paddingHorizontal: 26,
            marginTop: 22,
          }}
        >
          <Text
            className="font-ui font-bold text-white"
            style={{ fontSize: 14, letterSpacing: 0.6 }}
          >
            CREATE A TEAM
          </Text>
          <Feather name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </Pressable>
      </Reveal>
    </View>
  );
}
