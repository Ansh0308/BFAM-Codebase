import { io, Socket } from 'socket.io-client';

// Same shared-connection pattern as apps/mobile/src/lib/socket.ts — one
// connection to the default namespace, joining a `match:{matchId}` room
// per screen. Web's only current consumer is the Digital Scoreboard
// (PRD §12.20), which needs real ball-by-ball push updates since an LED
// display sits open for the whole match with nobody tapping back into it.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function joinMatchRoom(matchId: string) {
  getSocket().emit('join_match', { matchId });
}

export function leaveMatchRoom(matchId: string) {
  getSocket().emit('leave_match', { matchId });
}
