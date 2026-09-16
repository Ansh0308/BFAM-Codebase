'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { GameRoom, LiveScore } from '@bfam/shared-types';
import { apiClient } from '../../../../lib/apiClient';
import { getSocket, joinMatchRoom, leaveMatchRoom } from '../../../../lib/socket';

function displayName(p: { full_name?: string | null; bfam_id?: string } | undefined): string {
  if (!p) return '—';
  return p.full_name || p.bfam_id || '—';
}

function playerFor(players: GameRoom['players'], playerId: string | null | undefined) {
  return players.find((p) => p.player_id === playerId);
}

// Digital Scoreboard display (PRD §12.20) — meant to be left open, full
// screen, on a PC wired to a pitch's LED/TV for the whole match. Unlike the
// mobile Live Score screen (which only refetches on focus), this has to
// stay correct with nobody touching it, so it subscribes to
// match:score_update / match:intro_stage and re-fetches on every event
// rather than relying on any re-focus.
export default function ScoreboardDisplayPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const [live, setLive] = useState<LiveScore | null>(null);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const loadRef = useRef<() => void>(() => {});

  const load = useCallback(() => {
    Promise.all([apiClient.getLiveScore(matchId), apiClient.getGameRoom(matchId)])
      .then(([liveScore, gameRoom]) => {
        setLive(liveScore);
        setRoom(gameRoom);
        setLastUpdated(new Date());
      })
      .catch(() => {
        setLive(null);
        setRoom(null);
      })
      .finally(() => setLoading(false));
  }, [matchId]);

  loadRef.current = load;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    joinMatchRoom(matchId);

    const onUpdate = () => loadRef.current();
    socket.on('match:score_update', onUpdate);
    socket.on('match:intro_stage', onUpdate);

    return () => {
      socket.off('match:score_update', onUpdate);
      socket.off('match:intro_stage', onUpdate);
      leaveMatchRoom(matchId);
    };
  }, [matchId]);

  if (loading) {
    return (
      <div
        className="min-h-screen bg-black flex items-center justify-center"
        data-testid="scoreboard-display-loading"
      >
        <p className="font-ui text-white text-2xl">Loading…</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div
        className="min-h-screen bg-black flex items-center justify-center"
        data-testid="scoreboard-display-error"
      >
        <p className="font-ui text-white text-2xl">Could not load this match.</p>
      </div>
    );
  }

  const striker = playerFor(room.players, live?.current_striker_player_id);
  const nonStriker = playerFor(room.players, live?.current_non_striker_player_id);
  const bowler = playerFor(room.players, live?.current_bowler_player_id);
  const isCompleted = room.match_status === 'COMPLETED';

  return (
    <div
      className="min-h-screen bg-black text-white flex flex-col"
      data-testid="scoreboard-display"
    >
      <div className="px-12 pt-10 flex items-center justify-between">
        <h1 className="font-display uppercase tracking-wide text-4xl">
          {room.match_name ?? 'Live Match'}
        </h1>
        <span className="font-ui text-lg text-white/60" data-testid="scoreboard-last-updated">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ''}
        </span>
      </div>

      {live?.innings ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p
            className="font-display font-bold leading-none"
            style={{ fontSize: '18vw', color: '#D80000' }}
            data-testid="scoreboard-score"
          >
            {live.innings.total_runs}/{live.innings.total_wickets}
          </p>
          <p className="font-ui text-4xl text-white/80 mt-4">
            {live.innings.overs_completed} overs
          </p>

          {live.innings.target_runs != null && (
            <div className="flex gap-10 mt-8 font-ui text-3xl text-white/70">
              <span>Target: {live.innings.target_runs}</span>
              <span>CRR: {live.current_run_rate}</span>
              {live.required_run_rate != null && (
                <span style={{ color: '#D80000' }}>RRR: {live.required_run_rate}</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-8 mt-16 w-full max-w-5xl px-12">
            <div className="bg-white/10 rounded-xl p-6 text-center">
              <p className="font-ui uppercase text-lg text-white/50 mb-2">Striker</p>
              <p className="font-ui font-bold text-3xl">{displayName(striker)}*</p>
            </div>
            <div className="bg-white/10 rounded-xl p-6 text-center">
              <p className="font-ui uppercase text-lg text-white/50 mb-2">Non-Striker</p>
              <p className="font-ui font-bold text-3xl">{displayName(nonStriker)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-6 text-center">
              <p className="font-ui uppercase text-lg text-white/50 mb-2">Bowler</p>
              <p className="font-ui font-bold text-3xl">{displayName(bowler)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-ui text-4xl text-white/70" data-testid="scoreboard-no-innings">
            {isCompleted ? 'This match has finished.' : 'Waiting for the innings to start…'}
          </p>
        </div>
      )}
    </div>
  );
}
