import request from 'supertest';
import app from '../app';
import { ROLE_SCOPES } from '../services/authService';
import { USER_ROLES } from '../domain/constants';

describe('JWT auth and RBAC', () => {
  it.each(USER_ROLES)('issues and validates a correctly scoped JWT for %s', async (role) => {
    const tokenResponse = await request(app)
      .post('/auth/dev-token')
      .send({ role, bfam_id: 'BF1999' });

    expect(tokenResponse.status).toBe(201);
    expect(tokenResponse.body.token).toEqual(expect.any(String));

    const meResponse = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenResponse.body.token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.auth.role).toBe(role);
    expect(meResponse.body.auth.scopes).toEqual(ROLE_SCOPES[role]);
  });

  it('allows only ADMIN through an admin-scoped route', async () => {
    const adminToken = (await request(app).post('/auth/dev-token').send({ role: 'ADMIN' })).body
      .token;
    const playerToken = (await request(app).post('/auth/dev-token').send({ role: 'PLAYER' })).body
      .token;

    expect(
      (await request(app).get('/rbac/admin-check').set('Authorization', `Bearer ${adminToken}`))
        .status,
    ).toBe(200);
    expect(
      (await request(app).get('/rbac/admin-check').set('Authorization', `Bearer ${playerToken}`))
        .status,
    ).toBe(403);
  });
});
