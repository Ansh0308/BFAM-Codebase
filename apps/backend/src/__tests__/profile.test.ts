// Exercises GET/PATCH /profile/me end-to-end through supertest. Only the
// low-level `sequelize` driver calls are faked, since no real MySQL is
// available in this test environment (see registration.test.ts for the
// same pattern).

interface FakeUser {
  user_id: string;
  bfam_id: string | null;
  role: string;
  phone_number: string;
  email: string | null;
  email_verified_at: Date | null;
  profile_photo_url: string | null;
  city: string | null;
  preferred_language: string | null;
  deleted_at: Date | null;
}

interface FakePlayer {
  user_id: string;
  playing_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  experience_level: string | null;
  skill_rating: number;
  reliability_score: string;
  favorite_cricketer_name: string | null;
  favorite_cricketer_external_id: string | null;
}

let usersTable: FakeUser[] = [];
let playersTable: FakePlayer[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (
          sql.startsWith(
            'SELECT user_id, bfam_id, role, phone_number, email, email_verified_at, profile_photo_url, city, preferred_language FROM users',
          )
        ) {
          const user = usersTable.find((u) => u.user_id === r.userId && !u.deleted_at);
          return user ? [user] : [];
        }
        if (sql.startsWith('SELECT playing_role, batting_style, bowling_style, experience_level')) {
          const player = playersTable.find((p) => p.user_id === r.userId);
          return player ? [player] : [];
        }
        if (sql.startsWith('UPDATE users SET')) {
          const user = usersTable.find((u) => u.user_id === r.userId);
          if (user) Object.assign(user, r);
          return [];
        }
        if (sql.startsWith('UPDATE players SET')) {
          const player = playersTable.find((p) => p.user_id === r.userId);
          if (player) Object.assign(player, r);
          return [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (transaction: unknown) => Promise<unknown>) => fn({}),
    },
  };
});

// uploadService.ts is a thin wrapper around the AWS SDK — mocking it
// directly (rather than the SDK's S3Client class) keeps this test focused
// on the /profile/photo endpoint's own wiring (auth, validation, response
// shape) instead of fighting jest/ts-jest's constructor-mocking behavior
// for the SDK's ES module shape.
const mockIsS3Configured = jest.fn();
const mockUploadProfilePhoto = jest.fn();
jest.mock('../services/uploadService', () => ({
  isS3Configured: () => mockIsS3Configured(),
  isAllowedImageContentType: (contentType: string) =>
    ['image/jpeg', 'image/png', 'image/webp'].includes(contentType),
  uploadProfilePhoto: (...args: unknown[]) => mockUploadProfilePhoto(...args),
}));

import request from 'supertest';
import app from '../app';
import { issueJwt } from '../services/authService';

describe('GET/PATCH /profile/me', () => {
  beforeEach(() => {
    usersTable = [];
    playersTable = [];
  });

  it("returns a player's identity + player fields together", async () => {
    usersTable.push({
      user_id: 'p1',
      bfam_id: 'BF1000',
      role: 'PLAYER',
      phone_number: '+919876500001',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });
    playersTable.push({
      user_id: 'p1',
      playing_role: null,
      batting_style: null,
      bowling_style: null,
      experience_level: 'BEGINNER',
      skill_rating: 500,
      reliability_score: '100.00',
      favorite_cricketer_name: 'MS Dhoni',
      favorite_cricketer_external_id: 'fixture-ms-dhoni',
    });

    const token = issueJwt({ userId: 'p1', role: 'PLAYER', bfamId: 'BF1000' });
    const response = await request(app).get('/profile/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.bfam_id).toBe('BF1000');
    expect(response.body.favorite_cricketer_name).toBe('MS Dhoni');
    expect(response.body.experience_level).toBe('BEGINNER');
  });

  it('returns null player fields for a TURF_OWNER (no players row)', async () => {
    usersTable.push({
      user_id: 'o1',
      bfam_id: null,
      role: 'TURF_OWNER',
      phone_number: '+919876500002',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });

    const token = issueJwt({ userId: 'o1', role: 'TURF_OWNER', bfamId: null });
    const response = await request(app).get('/profile/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.bfam_id).toBeNull();
    expect(response.body.playing_role).toBeNull();
    expect(response.body.experience_level).toBeNull();
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get('/profile/me');
    expect(response.status).toBe(401);
  });

  it("updates a player's identity and player fields together", async () => {
    usersTable.push({
      user_id: 'p2',
      bfam_id: 'BF1001',
      role: 'PLAYER',
      phone_number: '+919876500003',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });
    playersTable.push({
      user_id: 'p2',
      playing_role: null,
      batting_style: null,
      bowling_style: null,
      experience_level: 'BEGINNER',
      skill_rating: 500,
      reliability_score: '100.00',
      favorite_cricketer_name: null,
      favorite_cricketer_external_id: null,
    });

    const token = issueJwt({ userId: 'p2', role: 'PLAYER', bfamId: 'BF1001' });
    const response = await request(app)
      .patch('/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        city: 'Rajkot',
        playing_role: 'ALL_ROUNDER',
        batting_style: 'RIGHT_HANDED',
        experience_level: 'INTERMEDIATE',
      });

    expect(response.status).toBe(200);
    expect(response.body.city).toBe('Rajkot');
    expect(response.body.playing_role).toBe('ALL_ROUNDER');
    expect(response.body.batting_style).toBe('RIGHT_HANDED');
    expect(response.body.experience_level).toBe('INTERMEDIATE');
  });

  it('silently ignores player-only fields for a TURF_STAFF update', async () => {
    usersTable.push({
      user_id: 's1',
      bfam_id: null,
      role: 'TURF_STAFF',
      phone_number: '+919876500004',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });

    const token = issueJwt({ userId: 's1', role: 'TURF_STAFF', bfamId: null });
    const response = await request(app)
      .patch('/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Ahmedabad', playing_role: 'BATTER' });

    expect(response.status).toBe(200);
    expect(response.body.city).toBe('Ahmedabad');
    expect(response.body.playing_role).toBeNull();
    expect(playersTable).toHaveLength(0);
  });

  it('rejects an invalid enum value', async () => {
    const token = issueJwt({ userId: 'p3', role: 'PLAYER', bfamId: 'BF1002' });
    const response = await request(app)
      .patch('/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ playing_role: 'NOT_A_ROLE' });

    expect(response.status).toBe(400);
  });

  it('silently ignores a plain "email" field — it can only be set via the verified-email flow', async () => {
    usersTable.push({
      user_id: 'p8',
      bfam_id: 'BF1008',
      role: 'PLAYER',
      phone_number: '+919876500008',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });

    const token = issueJwt({ userId: 'p8', role: 'PLAYER', bfamId: 'BF1008' });
    const response = await request(app)
      .patch('/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'newplayer@bfam.local', city: 'Rajkot' });

    expect(response.status).toBe(200);
    expect(response.body.email).toBeNull();
    expect(response.body.city).toBe('Rajkot');
  });

  it('accepts a preset avatar sentinel as profile_photo_url', async () => {
    usersTable.push({
      user_id: 'p12',
      bfam_id: 'BF1012',
      role: 'PLAYER',
      phone_number: '+919876500012',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });

    const token = issueJwt({ userId: 'p12', role: 'PLAYER', bfamId: 'BF1012' });
    const response = await request(app)
      .patch('/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ profile_photo_url: 'preset:bat-red' });

    expect(response.status).toBe(200);
    expect(response.body.profile_photo_url).toBe('preset:bat-red');
  });

  it('rejects an invalid bowling_style value', async () => {
    const token = issueJwt({ userId: 'p13', role: 'PLAYER', bfamId: 'BF1013' });
    const response = await request(app)
      .patch('/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bowling_style: 'SPIN' });

    expect(response.status).toBe(400);
  });

  it('accepts a valid bowling_style value', async () => {
    usersTable.push({
      user_id: 'p14',
      bfam_id: 'BF1014',
      role: 'PLAYER',
      phone_number: '+919876500014',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });
    playersTable.push({
      user_id: 'p14',
      playing_role: null,
      batting_style: null,
      bowling_style: null,
      experience_level: 'BEGINNER',
      skill_rating: 500,
      reliability_score: '100.00',
      favorite_cricketer_name: null,
      favorite_cricketer_external_id: null,
    });

    const token = issueJwt({ userId: 'p14', role: 'PLAYER', bfamId: 'BF1014' });
    const response = await request(app)
      .patch('/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bowling_style: 'LEFT_ARM' });

    expect(response.status).toBe(200);
    expect(response.body.bowling_style).toBe('LEFT_ARM');
  });

  it('accepts a valid gender value', async () => {
    usersTable.push({
      user_id: 'p15',
      bfam_id: 'BF1015',
      role: 'PLAYER',
      phone_number: '+919876500015',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });
    playersTable.push({
      user_id: 'p15',
      playing_role: null,
      batting_style: null,
      bowling_style: null,
      experience_level: 'BEGINNER',
      skill_rating: 500,
      reliability_score: '100.00',
      favorite_cricketer_name: null,
      favorite_cricketer_external_id: null,
    });

    const token = issueJwt({ userId: 'p15', role: 'PLAYER', bfamId: 'BF1015' });
    const response = await request(app)
      .patch('/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ gender: 'FEMALE' });

    expect(response.status).toBe(200);
    expect(response.body.gender).toBe('FEMALE');
  });

  it('rejects an invalid gender value', async () => {
    const token = issueJwt({ userId: 'p16', role: 'PLAYER', bfamId: 'BF1016' });
    const response = await request(app)
      .patch('/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ gender: 'UNSPECIFIED' });

    expect(response.status).toBe(400);
  });
});

describe('POST /profile/photo', () => {
  beforeEach(() => {
    usersTable = [];
    playersTable = [];
    mockIsS3Configured.mockReset();
    mockUploadProfilePhoto.mockReset();
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app).post('/profile/photo');
    expect(response.status).toBe(401);
  });

  it('returns 501 when S3 is not configured on the server', async () => {
    mockIsS3Configured.mockReturnValue(false);

    const token = issueJwt({ userId: 'p4', role: 'PLAYER', bfamId: 'BF1004' });
    const response = await request(app)
      .post('/profile/photo')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('fake-image-bytes'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(501);
    expect(mockUploadProfilePhoto).not.toHaveBeenCalled();
  });

  it('uploads and persists the resulting URL when S3 is configured', async () => {
    mockIsS3Configured.mockReturnValue(true);
    mockUploadProfilePhoto.mockResolvedValue(
      'https://bfam-uploads-test.s3.ap-south-1.amazonaws.com/profile-photos/p5/fake.jpg',
    );

    usersTable.push({
      user_id: 'p5',
      bfam_id: 'BF1005',
      role: 'PLAYER',
      phone_number: '+919876500006',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });

    const token = issueJwt({ userId: 'p5', role: 'PLAYER', bfamId: 'BF1005' });
    const response = await request(app)
      .post('/profile/photo')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('fake-image-bytes'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(200);
    expect(response.body.profile_photo_url).toBe(
      'https://bfam-uploads-test.s3.ap-south-1.amazonaws.com/profile-photos/p5/fake.jpg',
    );
    expect(usersTable[0].profile_photo_url).toBe(response.body.profile_photo_url);
    expect(mockUploadProfilePhoto).toHaveBeenCalledWith('p5', expect.any(Buffer), 'image/jpeg');
  });

  it('rejects an unsupported image type without calling uploadProfilePhoto', async () => {
    mockIsS3Configured.mockReturnValue(true);

    const token = issueJwt({ userId: 'p6', role: 'PLAYER', bfamId: 'BF1006' });
    const response = await request(app)
      .post('/profile/photo')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('not-an-image'), {
        filename: 'file.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(mockUploadProfilePhoto).not.toHaveBeenCalled();
  });

  it('returns 500 if the upload itself fails', async () => {
    mockIsS3Configured.mockReturnValue(true);
    mockUploadProfilePhoto.mockRejectedValue(new Error('S3 network error'));

    const token = issueJwt({ userId: 'p7', role: 'PLAYER', bfamId: 'BF1007' });
    const response = await request(app)
      .post('/profile/photo')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('fake-image-bytes'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(500);
  });
});
