import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { connectDatabase } from './config/sequelize';
import { runMigrations } from './config/migrate';
import { startReminderTicker } from './services/reminderService';
import { setIo } from './realtime/io';
import { registerMatchSocketHandlers } from './realtime/matchSocket';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO with CORS settings
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Configure Socket.IO health-check namespace
const healthNamespace = io.of('/health-check');
healthNamespace.on('connection', (socket) => {
  console.log(`Client connected to health-check namespace: ${socket.id}`);

  socket.emit('health_status', {
    status: 'ok',
    timestamp: new Date().toISOString(),
  });

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected from health-check namespace: ${socket.id}`);
  });
});

// Modules 2.7/2.8/2.9: per-match room (join_match/leave_match), intro
// stage relay, live score broadcast, and viewer presence — all on the
// default namespace, so a single client connection covers everything.
setIo(io);
registerMatchSocketHandlers(io);

// Listen on server
async function startServer() {
  // Connect database
  await connectDatabase();

  // Bring the schema up to date automatically — no manual `db:migrate` step
  // needed when hosting and pointing the backend at a fresh/updated DB.
  // Skipped in test env, where tests manage their own DB state/mocks.
  if (process.env.NODE_ENV !== 'test') {
    await runMigrations();
  }

  server.listen(PORT, () => {
    console.log(`BFAM Backend Server listening on port ${PORT}`);
    console.log(
      `Socket.IO health-check namespace listening at ws://localhost:${PORT}/health-check`,
    );
  });

  // Smart Reminders (PRD §12.13) — a real backend scheduled job, not a
  // client-side timer. Skipped in tests, same reasoning as runMigrations
  // above: tests manage their own state/mocks.
  if (process.env.NODE_ENV !== 'test') {
    startReminderTicker();
  }
}

startServer();
