import type { Server, Socket } from 'socket.io';
import { matchRoom } from './io';
import { registerPresenceHandlers } from '../services/presenceService';

// Wires the per-match Socket.IO room used by modules 2.7 (intro stage
// sync), 2.8 (live score broadcast), and 2.9 (viewer presence). One room
// per match (`match:{matchId}`) — join_match/leave_match are the only
// generic handlers here; 2.9's presence tracking registers its own
// handlers on the same socket (see registerPresenceHandlers).
export function registerMatchSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on('join_match', ({ matchId }: { matchId: string }) => {
      if (!matchId) return;
      socket.join(matchRoom(matchId));
    });

    socket.on('leave_match', ({ matchId }: { matchId: string }) => {
      if (!matchId) return;
      socket.leave(matchRoom(matchId));
    });

    // Module 2.7: the presenting client (whoever ran Start Match) drives
    // the countdown/XI-reveal/toss sequence locally with Reanimated, and
    // relays each stage transition here so every other connected viewer's
    // screen mirrors the same stage — everyone sees the same sequence in
    // sync (PRD §12.61), without the server owning the animation timing.
    socket.on(
      'match:intro_stage',
      (payload: { matchId: string; stage: string; data?: unknown }) => {
        if (!payload?.matchId || !payload?.stage) return;
        socket.to(matchRoom(payload.matchId)).emit('match:intro_stage', payload);
      },
    );

    registerPresenceHandlers(io, socket);
  });
}
