import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { TournamentListItem, TournamentStatus } from '@bfam/shared-types';
import { FORMAT_LABEL, STATUS_LABEL } from '../src/lib/tournamentLabels';
import { apiClient } from '../src/lib/apiClient';
import {
  Chip,
  HubCard,
  HubLoading,
  HubMessage,
  HubScreen,
  IconBadge,
  PillTabs,
} from '../src/components/hub/HubParts';

type Tab = 'open' | 'live' | 'done';

function bucket(status: TournamentStatus): Tab {
  if (status === 'IN_PROGRESS') return 'live';
  if (status === 'COMPLETED' || status === 'CANCELLED') return 'done';
  return 'open';
}

const day = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })
    : null;

// Tournaments (PRD §9): leagues and knockouts hosted at turfs. Captains enter
// their team from the detail screen; this list is how everyone finds them.
export default function TournamentsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<TournamentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('open');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getTournaments()
      .then((res) => setItems(res.results))
      .catch(() => setError('Could not load tournaments.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      open: items.filter((t) => bucket(t.status) === 'open').length,
      live: items.filter((t) => bucket(t.status) === 'live').length,
      done: items.filter((t) => bucket(t.status) === 'done').length,
    }),
    [items],
  );
  const visible = items.filter((t) => bucket(t.status) === tab);

  return (
    <HubScreen
      title="Tournaments"
      subtitle="Leagues and knockouts near you"
      backTestID="tournaments-back"
      testID="tournaments-screen"
      controls={
        <PillTabs<Tab>
          testIDPrefix="tournaments-tab"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'open', label: `Open${counts.open ? ` (${counts.open})` : ''}` },
            { value: 'live', label: `Live${counts.live ? ` (${counts.live})` : ''}` },
            { value: 'done', label: 'Finished' },
          ]}
        />
      }
    >
      {loading && <HubLoading testID="tournaments-loading" />}
      {error && <HubMessage tone="error">{error}</HubMessage>}

      {!loading && !error && visible.length === 0 && (
        <HubMessage icon="trophy-outline" testID="tournaments-empty">
          {tab === 'open'
            ? 'No tournaments are taking entries right now. Check back soon.'
            : tab === 'live'
              ? 'No tournament is being played right now.'
              : 'No finished tournaments yet.'}
        </HubMessage>
      )}

      {!loading &&
        visible.map((t) => (
          <Pressable
            key={t.tournament_id}
            onPress={() => router.push(`/tournament/${t.tournament_id}`)}
            accessibilityRole="button"
            testID={`tournament-${t.tournament_id}`}
          >
            <HubCard>
              <View className="flex-row items-start">
                <IconBadge icon="trophy" size={44} />
                <View className="flex-1" style={{ marginLeft: 12 }}>
                  <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 16 }}>
                    {t.name}
                  </Text>
                  <Text
                    className="font-ui text-text-tertiary"
                    style={{ fontSize: 12, marginTop: 2 }}
                  >
                    {FORMAT_LABEL[t.format]} · {t.overs_per_innings} overs
                    {t.turf_name ? ` · ${t.turf_name}` : ''}
                  </Text>
                </View>
                <Chip
                  text={STATUS_LABEL[t.status].toUpperCase()}
                  tone={t.status === 'IN_PROGRESS' ? 'solid' : 'red'}
                />
              </View>
              <View className="flex-row items-center justify-between" style={{ marginTop: 12 }}>
                <Text className="font-ui text-text-secondary" style={{ fontSize: 13 }}>
                  {Number(t.teams)}/{t.max_teams} teams
                  {day(t.start_date) ? ` · starts ${day(t.start_date)}` : ''}
                </Text>
                <Text className="font-display text-brand-red" style={{ fontSize: 18 }}>
                  {Number(t.entry_fee) > 0
                    ? `₹${Number(t.entry_fee).toLocaleString('en-IN')} entry`
                    : 'Free entry'}
                </Text>
              </View>
            </HubCard>
          </Pressable>
        ))}
    </HubScreen>
  );
}
