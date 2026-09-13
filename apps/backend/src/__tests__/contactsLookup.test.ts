// API integration test for backlog B-2: POST /players/contacts-lookup.
// Only `sequelize` is faked — the real route/service runs unmodified.

interface RegisteredRow {
  phone_number: string;
  player_id: string;
  bfam_id: string;
  full_name: string | null;
}

const CALLER_USER = 'aaaaaaaa-0000-4000-8000-000000000301';

const registeredPlayers: RegisteredRow[] = [
  {
    phone_number: '+919876543210',
    player_id: '11111111-0000-4000-8000-000000000302',
    bfam_id: 'BF1001',
    full_name: 'Asha Patel',
  },
  {
    phone_number: '+918888888888',
    player_id: '22222222-0000-4000-8000-000000000303',
    bfam_id: 'BF1002',
    full_name: null,
  },
];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        if (sql.includes('FROM users u') && sql.includes('JOIN players p')) {
          const keys = (options.replacements?.normalizedKeys as string[]) ?? [];
          return registeredPlayers.filter((p) =>
            keys.includes(p.phone_number.replace(/\D/g, '').slice(-10)),
          );
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('POST /players/contacts-lookup (backlog B-2)', () => {
  it("returns only the contacts that match a registered player, preserving the caller's original formatting", async () => {
    const token = await tokenFor(CALLER_USER);
    const res = await request(app)
      .post('/players/contacts-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({
        phone_numbers: [
          '+91 98765 43210', // matches, differently formatted
          '+911234567890', // no match
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      {
        phone_number: '+91 98765 43210',
        player_id: '11111111-0000-4000-8000-000000000302',
        bfam_id: 'BF1001',
        full_name: 'Asha Patel',
      },
    ]);
  });

  it('never echoes back a marker for non-matching numbers — they are simply absent', async () => {
    const token = await tokenFor(CALLER_USER);
    const res = await request(app)
      .post('/players/contacts-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_numbers: ['+911234567890'] });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('de-duplicates the same registered player appearing under multiple contact entries', async () => {
    const token = await tokenFor(CALLER_USER);
    const res = await request(app)
      .post('/players/contacts-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_numbers: ['+919876543210', '919876543210', '9876543210'] });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app)
      .post('/players/contacts-lookup')
      .send({ phone_numbers: ['9876543210'] });
    expect(res.status).toBe(401);
  });

  it('rejects an empty or oversized batch', async () => {
    const token = await tokenFor(CALLER_USER);
    const empty = await request(app)
      .post('/players/contacts-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_numbers: [] });
    expect(empty.status).toBe(400);

    const oversized = await request(app)
      .post('/players/contacts-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_numbers: Array.from({ length: 2001 }, (_, i) => String(9000000000 + i)) });
    expect(oversized.status).toBe(400);
  });
});
