// Unit tests for the pure support-ticket status state machine (module
// 2.13, PRD §12.57/§32.2 "dispute flow's state transitions"). No DB
// involved — this is what makes an invalid transition (e.g. CLOSED ->
// OPEN) impossible to reach the database in the first place.

import { isValidStatusTransition, type SupportStatus } from '../domain/supportTicket';

describe('isValidStatusTransition', () => {
  it('OPEN can move to IN_PROGRESS or CLOSED', () => {
    expect(isValidStatusTransition('OPEN', 'IN_PROGRESS')).toBe(true);
    expect(isValidStatusTransition('OPEN', 'CLOSED')).toBe(true);
  });

  it('OPEN cannot jump straight to RESOLVED', () => {
    expect(isValidStatusTransition('OPEN', 'RESOLVED')).toBe(false);
  });

  it('IN_PROGRESS can move to RESOLVED or CLOSED', () => {
    expect(isValidStatusTransition('IN_PROGRESS', 'RESOLVED')).toBe(true);
    expect(isValidStatusTransition('IN_PROGRESS', 'CLOSED')).toBe(true);
  });

  it('IN_PROGRESS cannot move back to OPEN', () => {
    expect(isValidStatusTransition('IN_PROGRESS', 'OPEN')).toBe(false);
  });

  it('RESOLVED can be reopened to IN_PROGRESS, or closed', () => {
    expect(isValidStatusTransition('RESOLVED', 'IN_PROGRESS')).toBe(true);
    expect(isValidStatusTransition('RESOLVED', 'CLOSED')).toBe(true);
  });

  it('RESOLVED cannot jump back to OPEN', () => {
    expect(isValidStatusTransition('RESOLVED', 'OPEN')).toBe(false);
  });

  it('CLOSED is terminal — no transition out of it is valid', () => {
    const targets: SupportStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    for (const target of targets) {
      expect(isValidStatusTransition('CLOSED', target)).toBe(false);
    }
  });

  it('a status never "transitions" to itself', () => {
    const statuses: SupportStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    for (const status of statuses) {
      expect(isValidStatusTransition(status, status)).toBe(false);
    }
  });
});
