// "Invite players with BFAM ID: entering a valid id shows 'invalid invitation payload'". The
// Invite Players box collects the BFAM ID a player is known by ("BF1001"), but the endpoint only
// took the internal player_id UUID. It now takes either, like team invitations do.

const mockInviteToMatch = jest.fn();
const mockResolve = jest.fn();

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: jest.fn().mockResolvedValue([]),
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
    getQueryInterface: () => ({}),
  },
}));
jest.mock('../services/matchService', () => ({
  ...jest.requireActual('../services/matchService'),
  inviteToMatch: (...args: unknown[]) => mockInviteToMatch(...args),
}));
jest.mock('../services/teamService', () => ({
  ...jest.requireActual('../services/teamService'),
  resolvePlayerIdByBfamId: (...args: unknown[]) => mockResolve(...args),
}));

import request from 'supertest';
import app from '../app';
import { PlayerNotFoundByBfamIdError } from '../domain/errors';

const MATCH_ID = 'aaaaaaaa-0000-4000-8000-000000003601';
const PLAYER_UUID = 'bbbbbbbb-0000-4000-8000-000000003602';

async function token() {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER' });
  return res.body.token as string;
}

describe('POST /matches/:matchId/invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInviteToMatch.mockResolvedValue({ invitation_id: 'inv-1' });
  });

  it('invites by BFAM ID', async () => {
    mockResolve.mockResolvedValue(PLAYER_UUID);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/invitations`)
      .set('Authorization', `Bearer ${await token()}`)
      .send({ bfam_id: 'BF1001' });

    expect(res.status).toBe(201);
    expect(mockResolve).toHaveBeenCalledWith('BF1001');
    expect(mockInviteToMatch).toHaveBeenCalledWith(MATCH_ID, expect.any(String), PLAYER_UUID);
  });

  it('still invites by player_id', async () => {
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/invitations`)
      .set('Authorization', `Bearer ${await token()}`)
      .send({ player_id: PLAYER_UUID });

    expect(res.status).toBe(201);
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockInviteToMatch).toHaveBeenCalledWith(MATCH_ID, expect.any(String), PLAYER_UUID);
  });

  it('says so plainly when no player has that BFAM ID', async () => {
    mockResolve.mockRejectedValue(new PlayerNotFoundByBfamIdError('BF9999'));
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/invitations`)
      .set('Authorization', `Bearer ${await token()}`)
      .send({ bfam_id: 'BF9999' });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/BF9999/);
  });

  it('asks for a BFAM ID when neither id is sent', async () => {
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/invitations`)
      .set('Authorization', `Bearer ${await token()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/BFAM ID/);
  });
});
