import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import type { MyTeam } from '@bfam/shared-types';
import { colors } from '../../theme/tokens';
import { Reveal } from '../Reveal';

// Primary action. Scales to 0.97 on press, the arrow slides right, the red
// brightens a touch and a soft white highlight sweeps across once — all in
// ~300ms, nothing flashy.
export function CreateTeamButton({ onPress, testID }: { onPress: () => void; testID: string }) {
  const [pressed, setPressed] = useState(false);
  const [sweep, setSweep] = useState(0);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 380, delay: 320 }}
    >
      <MotiView
        animate={{ scale: pressed ? 0.97 : 1 }}
        transition={{ type: 'timing', duration: 140 }}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            setPressed(true);
            setSweep((n) => n + 1);
          }}
          onPressOut={() => setPressed(false)}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel="Create Team"
          className="flex-row items-center justify-center"
          style={{
            height: 56,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: pressed ? '#F0180C' : '#E10600',
            shadowColor: colors.brandRed,
            shadowOpacity: 0.28,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          {sweep > 0 && (
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
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text
            className="font-ui font-bold text-white"
            style={{ fontSize: 16, letterSpacing: 0.8, marginLeft: 10 }}
          >
            CREATE TEAM
          </Text>
          <MotiView
            animate={{ translateX: pressed ? 6 : 0 }}
            transition={{ type: 'timing', duration: 160 }}
            style={{ marginLeft: 10 }}
          >
            <Feather name="arrow-right" size={20} color="#FFFFFF" />
          </MotiView>
        </Pressable>
      </MotiView>
    </MotiView>
  );
}

// Secondary action: white with a red outline. On touch the outline firms up,
// the icon and arrow each nudge a few px.
export function FindOpenTeamsButton({ onPress, testID }: { onPress: () => void; testID: string }) {
  const [pressed, setPressed] = useState(false);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 380, delay: 400 }}
    >
      <MotiView
        animate={{ scale: pressed ? 0.98 : 1 }}
        transition={{ type: 'timing', duration: 140 }}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel="Find Open Teams"
          className="flex-row items-center justify-center"
          style={{
            height: 56,
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            borderWidth: pressed ? 2 : 1.5,
            borderColor: pressed ? '#F0180C' : '#E10600',
          }}
        >
          <MotiView
            animate={{ translateX: pressed ? 3 : 0 }}
            transition={{ type: 'timing', duration: 160 }}
          >
            <Feather name="users" size={20} color={colors.brandRed} />
          </MotiView>
          <Text
            className="font-ui font-bold text-ink-black"
            style={{ fontSize: 16, letterSpacing: 0.8, marginLeft: 10 }}
          >
            FIND OPEN TEAMS
          </Text>
          <MotiView
            animate={{ translateX: pressed ? 6 : 0 }}
            transition={{ type: 'timing', duration: 160 }}
            style={{ marginLeft: 10 }}
          >
            <Feather name="arrow-right" size={20} color={colors.brandRed} />
          </MotiView>
        </Pressable>
      </MotiView>
    </MotiView>
  );
}

// Circular crest: the team's own logo when it has one, otherwise a black
// shield with the team's initial on a soft grey disc and a red underline.
function TeamCrest({ team }: { team: MyTeam }) {
  const size = 66;
  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#F2F2F2',
        overflow: 'hidden',
        marginRight: 16,
      }}
    >
      {team.team_logo_url ? (
        <Image
          source={{ uri: team.team_logo_url }}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      ) : (
        <>
          <MaterialCommunityIcons name="shield" size={46} color="#111111" />
          <Text
            className="font-display text-white"
            style={{ position: 'absolute', fontSize: 20, top: 19 }}
          >
            {team.team_name.trim().charAt(0).toUpperCase()}
          </Text>
          <View
            style={{
              position: 'absolute',
              bottom: 13,
              width: 16,
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.brandRed,
            }}
          />
        </>
      )}
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
  withDivider,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  withDivider?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        borderLeftWidth: withDivider ? 1 : 0,
        borderLeftColor: '#E8E8E8',
      }}
    >
      <View className="flex-row items-center">
        {icon}
        <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 17, marginLeft: 5 }}>
          {value}
        </Text>
      </View>
      <Text className="font-ui text-text-secondary" style={{ fontSize: 11, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export function TeamCard({
  team,
  index,
  onPress,
  onCopy,
}: {
  team: MyTeam;
  index: number;
  onPress: () => void;
  onCopy: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const icon = (name: 'account-multiple-outline' | 'trophy-outline' | 'chart-line-variant') => (
    <MaterialCommunityIcons name={name} size={16} color={colors.brandRed} />
  );

  return (
    <Reveal delay={120 + Math.min(index, 4) * 100} distance={12} duration={420}>
      <MotiView
        animate={{ scale: pressed ? 0.985 : 1, translateY: pressed ? -2 : 0 }}
        transition={{ type: 'timing', duration: 150 }}
        style={{ marginBottom: 14 }}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          testID={`my-team-row-${team.team_id}`}
          accessibilityRole="button"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E8E8E8',
            paddingVertical: 18,
            paddingRight: 14,
            paddingLeft: 22,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: pressed ? 0.1 : 0.04,
            shadowRadius: pressed ? 14 : 10,
            shadowOffset: { width: 0, height: pressed ? 6 : 2 },
          }}
        >
          <MotiView
            animate={{ width: pressed ? 6 : 4, backgroundColor: pressed ? '#F0180C' : '#E10600' }}
            transition={{ type: 'timing', duration: 150 }}
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }}
          />
          <View className="flex-row items-center">
            <TeamCrest team={team} />
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center" style={{ marginRight: 8 }}>
                  <Text
                    className="font-ui font-bold text-ink-black flex-shrink"
                    style={{ fontSize: 19 }}
                    numberOfLines={1}
                  >
                    {team.team_name}
                  </Text>
                  {team.role_in_team === 'CAPTAIN' && (
                    <Text
                      style={{
                        color: colors.brandRed,
                        fontSize: 10,
                        fontWeight: '700',
                        letterSpacing: 1,
                        marginLeft: 8,
                      }}
                    >
                      CAPTAIN
                    </Text>
                  )}
                </View>
                {/* Backlog A-11: copy this team's details into a brand-new
                    Create Team form — minimal-clicks alternative to starting
                    from scratch, same precedent as Rebook Same Players
                    (module 2.10). */}
                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation();
                    onCopy();
                  }}
                  className="items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#F2F2F2',
                  }}
                  testID={`copy-team-${team.team_id}`}
                  accessibilityLabel={`Copy ${team.team_name} into a new team`}
                  hitSlop={8}
                >
                  <Feather name="copy" size={15} color={colors.brandRed} />
                </Pressable>
              </View>
              <Text
                className="font-ui text-text-secondary"
                style={{ fontSize: 15, marginTop: 2 }}
                numberOfLines={1}
              >
                {team.home_city ?? 'No home city set'}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center" style={{ marginTop: 16 }}>
            <View className="flex-1 flex-row" testID={`my-team-stats-${team.team_id}`}>
              <Stat
                icon={icon('account-multiple-outline')}
                value={String(team.member_count ?? 0)}
                label="Members"
              />
              <Stat
                icon={icon('trophy-outline')}
                value={String(team.matches_played ?? 0)}
                label="Matches"
                withDivider
              />
              <Stat
                icon={icon('chart-line-variant')}
                value={`${team.wins ?? 0} - ${team.losses ?? 0}`}
                label="Win - Loss"
                withDivider
              />
            </View>
            <MotiView
              animate={{ translateX: pressed ? 4 : 0 }}
              transition={{ type: 'timing', duration: 160 }}
              style={{ marginLeft: 8 }}
            >
              <Feather name="chevron-right" size={22} color="#111111" />
            </MotiView>
          </View>
        </Pressable>
      </MotiView>
    </Reveal>
  );
}

// Three monochrome silhouettes with a red cricket-ball badge. The figures
// fade in together, the badge slides into place, then the copy follows.
export function EmptyTeams({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="items-center" style={{ marginTop: 8 }} testID="my-teams-empty">
      <MotiView
        from={{ opacity: 0, translateY: 14 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 600 }}
        style={{ flexDirection: 'row', alignItems: 'flex-end' }}
      >
        <MaterialCommunityIcons name="account" size={64} color="#D0D0D0" />
        <MaterialCommunityIcons name="account" size={92} color="#111111" />
        <MaterialCommunityIcons name="account" size={64} color="#D0D0D0" />
      </MotiView>
      <MotiView
        from={{ opacity: 0, translateX: 24 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 500, delay: 350 }}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.brandRed,
          marginTop: -18,
          marginLeft: 70,
        }}
      >
        <MaterialCommunityIcons name="cricket" size={18} color="#FFFFFF" />
      </MotiView>
      <MotiView
        from={{ width: 0 }}
        animate={{ width: 44 }}
        transition={{ type: 'timing', duration: 500, delay: 500 }}
        style={{ height: 3, borderRadius: 2, backgroundColor: colors.brandRed, marginTop: 14 }}
      />
      <Reveal delay={600}>
        <Text
          className="font-display text-ink-black text-center"
          style={{ fontSize: 26, marginTop: 16 }}
        >
          NO TEAMS YET
        </Text>
        <Text
          className="font-ui text-text-secondary text-center"
          style={{ fontSize: 15, marginTop: 8 }}
          testID="my-teams-empty-copy"
        >
          Create your first team and start playing together.
        </Text>
      </Reveal>
      <Reveal delay={800}>
        <Pressable
          onPress={onCreate}
          testID="my-teams-empty-create"
          accessibilityRole="button"
          className="flex-row items-center justify-center"
          style={{
            height: 52,
            borderRadius: 12,
            backgroundColor: '#E10600',
            paddingHorizontal: 28,
            marginTop: 20,
          }}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text
            className="font-ui font-bold text-white"
            style={{ fontSize: 15, letterSpacing: 0.8, marginLeft: 8 }}
          >
            CREATE TEAM
          </Text>
        </Pressable>
      </Reveal>
    </View>
  );
}
