import { io, Socket } from 'socket.io-client';

// Shared Socket.IO connection for everything match-realtime: intro stage
// sync (module 2.7), live score broadcast (module 2.8), and viewer
// presence (module 2.9) all multiplex over one connection to the default
// namespace, joining/leaving a `match:{matchId}` room per screen.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

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
