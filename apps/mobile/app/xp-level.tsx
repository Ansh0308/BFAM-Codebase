import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { LevelProgress, XpTransaction } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import {
  Chip,
  HeroCard,
  HubCard,
  HubLoading,
  HubMessage,
  HubScreen,
  IconBadge,
  ProgressBar,
  SectionLabel,
} from '../src/components/hub/HubParts';

const XP_REASON_LABELS: Record<string, string> = {
  REVIEW_REWARD: 'Submitted a review',
  ADMIN_ADJUSTMENT: 'Admin adjustment',
};

// The level ladder, as set in apps/backend/src/services/xpService.ts (LEVEL_THRESHOLDS) and
// the review reward in reviewService.ts (XP_REWARD_PER_REVIEW) — keep in step if those change.
const LEVELS = [
  { level: 'Newbie', minXp: 0 },
  { level: 'Rookie', minXp: 100 },
  { level: 'Player', minXp: 300 },
  { level: 'Pro', minXp: 700 },
  { level: 'Elite', minXp: 1500 },
  { level: 'Legend', minXp: 3000 },
];
const XP_PER_REVIEW = 10;

// XP & Player Levels (long tail, PRD §12.35) — a separate progression
// system from BFAM Coins. See xpService.ts for the level thresholds and
// which events grant XP in this first cut.
export default function XpLevelScreen() {
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [history, setHistory] = useState<XpTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([apiClient.getPlayerLevel('me'), apiClient.getPlayerXpHistory('me')])
      .then(([progressRes, historyRes]) => {
        setProgress(progressRes);
        setHistory(historyRes.results);
      })
      .catch(() => setError('Could not load your level and XP.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <HubScreen
      title="Level & XP"
      subtitle="Play, review and level up"
      backTestID="xp-level-back"
      testID="xp-level-screen"
    >
      {loading && <HubLoading testID="xp-level-loading" />}

      {!loading && error && <HubMessage tone="error">{error}</HubMessage>}

      {!loading && !error && progress && (
        <>
          <HeroCard testID="level-card">
            <Text
              className="font-ui"
              style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' }}
            >
              YOUR LEVEL
            </Text>
            <Text
              className="font-display uppercase"
              style={{ fontSize: 44, lineHeight: 50, color: '#FFFFFF', marginTop: 2 }}
              testID="level-name"
            >
              {progress.level}
            </Text>
            <Text
              className="font-ui font-bold"
              style={{ fontSize: 15, color: '#FFFFFF', marginTop: 2 }}
              testID="xp-total"
            >
              {progress.xp_total} XP
            </Text>

            {progress.next_level ? (
              <View style={{ marginTop: 16 }}>
                <ProgressBar onDark percent={progress.progress_percent} testID="xp-progress-bar" />
                <Text
                  className="font-ui"
                  style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 8 }}
                >
                  {progress.xp_into_level} / {progress.xp_for_next_level} XP to{' '}
                  {progress.next_level}
                </Text>
              </View>
            ) : (
              <Text
                className="font-ui"
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 14 }}
              >
                Max level reached
              </Text>
            )}
          </HeroCard>

          <SectionLabel>How to earn XP</SectionLabel>
          <HubCard>
            <View className="flex-row items-center">
              <IconBadge icon="star-circle" size={38} />
              <View className="flex-1" style={{ marginLeft: 12 }}>
                <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 14 }}>
                  Review a match you played
                </Text>
                <Text className="font-ui text-text-secondary" style={{ fontSize: 12.5 }}>
                  XP builds your level. Unlike coins, it can&apos;t be spent.
                </Text>
              </View>
              <Text className="font-ui font-bold text-brand-red" style={{ fontSize: 14 }}>
                {XP_PER_REVIEW} XP
              </Text>
            </View>
          </HubCard>

          <SectionLabel>Levels</SectionLabel>
          <HubCard style={{ paddingVertical: 6 }}>
            {LEVELS.map((l, i) => {
              const current = l.level === progress.level;
              return (
                <View
                  key={l.level}
                  className="flex-row items-center justify-between"
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: i === LEVELS.length - 1 ? 0 : 1,
                    borderBottomColor: '#F1F1F1',
                  }}
                >
                  <View className="flex-row items-center">
                    <Text
                      className={`font-ui text-body ${current ? 'font-bold text-brand-red' : 'text-text-primary'}`}
                    >
                      {l.level}
                    </Text>
                    {current ? (
                      <View style={{ marginLeft: 8 }}>
                        <Chip text="YOU" tone="solid" />
                      </View>
                    ) : null}
                  </View>
                  <Text className="font-ui text-micro text-text-tertiary">{l.minXp} XP</Text>
                </View>
              );
            })}
          </HubCard>

          <SectionLabel>XP History</SectionLabel>
          {history.length === 0 ? (
            <HubMessage icon="star-four-points" testID="xp-history-empty">
              No XP earned yet.
            </HubMessage>
          ) : (
            history.map((entry) => (
              <HubCard
                key={entry.xp_transaction_id}
                style={{ marginBottom: 8, paddingVertical: 12 }}
                testID={`xp-history-row-${entry.xp_transaction_id}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-ui text-body text-text-primary">
                    {XP_REASON_LABELS[entry.reason] ?? entry.reason}
                  </Text>
                  <Text className="font-ui font-bold text-body text-brand-red">
                    +{entry.amount}
                  </Text>
                </View>
              </HubCard>
            ))
          )}
        </>
      )}
    </HubScreen>
  );
}
