// Pure support-ticket status state machine (module 2.13, PRD §12.57/§32.2).
// Deliberately DB-free so the dispute flow's state transitions can be
// unit-tested directly.

export type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

// OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED is the normal path. A ticket
// can be closed directly from OPEN or IN_PROGRESS (withdrawn/duplicate),
// and a RESOLVED ticket can be reopened to IN_PROGRESS if the resolution
// didn't actually hold up — CLOSED is the only terminal state.
const ALLOWED_TRANSITIONS: Record<SupportStatus, SupportStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

export function isValidStatusTransition(from: SupportStatus, to: SupportStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}
