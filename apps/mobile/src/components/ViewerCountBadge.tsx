import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../lib/apiClient';
import { getSocket, joinMatchRoom, leaveMatchRoom } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/tokens';

interface ViewerCountBadgeProps {
  matchId: string;
}

// "👁 N Watching Live" (module 2.9, PRD §12.62) — the slot module 2.8's
// Live Score header left for this. Styled with the live-indicator red
// token (Design §1.3/§4.3) — this is a data-forward scoreboard reading,
// never a green "active" badge. `active` is de-duplicated per viewer by
// the backend's Redis presence set; `total` is a separate lifetime count
// of every session that has ever joined, not a live figure.
export function ViewerCountBadge({ matchId }: ViewerCountBadgeProps) {
  const user = useAuthStore((s) => s.user);
  const [active, setActive] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .getViewerCount(matchId)
      .then((res) => {
        setActive(res.active);
        setTotal(res.total);
      })
      .catch(() => {});

    const socket = getSocket();
    joinMatchRoom(matchId);
    socket.emit('join_match_viewer', { matchId, userId: user?.user_id });

    const heartbeat = setInterval(() => {
      socket.emit('heartbeat_match_viewer', { matchId, userId: user?.user_id });
    }, 15_000);

    function onViewerCount(payload: { matchId: string; active: number; total: number }) {
      if (payload.matchId !== matchId) return;
      setActive(payload.active);
      setTotal(payload.total);
    }
    socket.on('match:viewer_count', onViewerCount);

    return () => {
      clearInterval(heartbeat);
      socket.off('match:viewer_count', onViewerCount);
      socket.emit('leave_match_viewer', { matchId, userId: user?.user_id });
      leaveMatchRoom(matchId);
    };
  }, [matchId, user?.user_id]);

  if (active === null) return null;

  return (
    <View className="flex-row items-center" testID="viewer-count-badge">
      <Feather name="eye" size={14} color={colors.liveIndicator} />
      <Text
        className="font-ui font-bold text-micro text-live-indicator ml-1"
        testID="viewer-count-active"
      >
        {active} Watching Live
      </Text>
      {total != null && (
        <Text className="font-ui text-micro text-text-tertiary ml-2" testID="viewer-count-total">
          · {total} total views
        </Text>
      )}
    </View>
  );
}
