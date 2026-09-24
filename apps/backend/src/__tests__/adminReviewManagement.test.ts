// Exercises GET /admin/reviews and DELETE /admin/reviews/:reviewId
// (backlog E-5). Only `sequelize` is faked — the real routes/services run
// unmodified.

interface ReviewRow {
  review_id: string;
  match_id: string | null;
  turf_id: string;
  player_id: string;
  rating: number;
  review_text: string | null;
  created_at: Date;
}

const ADMIN_ID = 'aaaaaaaa-0000-4000-8000-001001';
const PLAYER_ID = 'bbbbbbbb-0000-4000-8000-001002';
const TURF_ID = 'cccccccc-0000-4000-8000-001003';

let reviews: ReviewRow[];
let turfs: Array<{ turf_id: string; turf_name: string; average_rating: string | null }>;
let players: Array<{ player_id: string; full_name: string | null }>;
let auditLogs: Array<Record<string, unknown>>;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM reviews r') && sql.includes('JOIN turfs t')) {
          return reviews.map((rev) => {
            const turf = turfs.find((t) => t.turf_id === rev.turf_id);
            const player = players.find((p) => p.player_id === rev.player_id);
            return {
              ...rev,
              turf_name: turf?.turf_name ?? '',
              player_name: player?.full_name ?? null,
            };
          });
        }
        if (sql.includes('SELECT turf_id, rating, player_id FROM reviews WHERE review_id')) {
          const rev = reviews.find((x) => x.review_id === r.reviewId);
          return rev ? [rev] : [];
        }
        if (sql.includes('SELECT AVG(rating) AS avgRating FROM reviews WHERE turf_id')) {
          const matching = reviews.filter((x) => x.turf_id === r.turfId);
          const avg = matching.length
            ? matching.reduce((sum, x) => sum + x.rating, 0) / matching.length
            : null;
          return [{ avgRating: avg }];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkDelete: async (table: string, where: Record<string, unknown>) => {
          if (table === 'reviews') {
            reviews = reviews.filter((x) => x.review_id !== where.review_id);
          }
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'turfs') {
            const t = turfs.find((x) => x.turf_id === where.turf_id);
            if (t) Object.assign(t, values);
          }
        },
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'audit_logs') auditLogs.push(...rows);
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(role: 'ADMIN' | 'PLAYER', userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('Admin Reviews Management (backlog E-5)', () => {
  beforeEach(() => {
    reviews = [
      {
        review_id: 'review-1',
        match_id: 'match-1',
        turf_id: TURF_ID,
        player_id: PLAYER_ID,
        rating: 5,
        review_text: 'Great turf!',
        created_at: new Date(),
      },
      {
        review_id: 'review-2',
        match_id: null,
        turf_id: TURF_ID,
        player_id: PLAYER_ID,
        rating: 1,
        review_text: 'Abusive spam text',
        created_at: new Date(),
      },
    ];
    turfs = [{ turf_id: TURF_ID, turf_name: 'Green Park Box Cricket', average_rating: '3.0' }];
    players = [{ player_id: PLAYER_ID, full_name: 'Asha Patel' }];
    auditLogs = [];
  });

  describe('GET /admin/reviews', () => {
    it('lists every review across every turf, with turf and player names attached', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app).get('/admin/reviews').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0]).toMatchObject({
        turf_name: 'Green Park Box Cricket',
        player_name: 'Asha Patel',
      });
    });

    it('rejects a non-admin caller', async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const res = await request(app).get('/admin/reviews').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /admin/reviews/:reviewId', () => {
    it('removes a review, recomputes the turf average rating, and writes an audit log entry', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .delete('/admin/reviews/review-2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(reviews).toHaveLength(1);
      expect(reviews[0].review_id).toBe('review-1');
      // Only the 5-star review remains -> average is now 5, not the stale 3.0.
      expect(turfs[0].average_rating).toBe(5);
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]).toMatchObject({
        action: 'REVIEW_DELETED',
        resource_id: 'review-2',
        actor_user_id: ADMIN_ID,
        actor_role: 'ADMIN',
      });
    });

    it('returns 404 for an unknown review', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .delete('/admin/reviews/not-a-real-review')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(auditLogs).toHaveLength(0);
    });

    it('rejects a non-admin caller', async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const res = await request(app)
        .delete('/admin/reviews/review-1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(reviews).toHaveLength(2);
    });
  });
});
