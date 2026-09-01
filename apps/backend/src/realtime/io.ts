import type { Server } from 'socket.io';

// Services (matchIntroService, scoringService, presenceService) need to
// emit Socket.IO events, but the `io` server instance is constructed in
// index.ts alongside the HTTP server — this module is just a settable
// reference so those services don't need to import index.ts (which would
// be circular: index.ts imports app.ts which mounts the routes that use
// these services).
let ioInstance: Server | null = null;

export function setIo(io: Server) {
  ioInstance = io;
}

export function getIo(): Server | null {
  return ioInstance;
}

export function matchRoom(matchId: string) {
  return `match:${matchId}`;
}
