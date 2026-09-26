// Regression for a critical finding in the deployment audit: POST
// /auth/dev-token minted an ADMIN token for anyone when NODE_ENV=production.
// Anything that is only safe on a developer's machine must fail CLOSED.

jest.mock('../config/sequelize', () => ({
  sequelize: { query: async () => [] },
}));

import request from 'supertest';
import app from '../app';
import { isLocalDevOrTest } from '../config/env';

const ORIGINAL_ENV = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
});

describe('isLocalDevOrTest', () => {
  it.each([
    ['development', true],
    ['test', true],
    ['production', false],
    ['staging', false],
    ['', false],
    [undefined, false],
  ])('NODE_ENV=%s -> %s', (value, expected) => {
    if (value === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = value;
    expect(isLocalDevOrTest()).toBe(expected);
  });
});

describe('POST /auth/dev-token', () => {
  it('still works in test/development (the suite depends on it)', async () => {
    process.env.NODE_ENV = 'test';
    const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER' });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it.each(['production', 'staging', ''])(
    'is a 404 that issues no token when NODE_ENV=%p — even for an ADMIN request',
    async (env) => {
      process.env.NODE_ENV = env;
      const res = await request(app)
        .post('/auth/dev-token')
        .send({ role: 'ADMIN', user_id: 'anyone' });
      expect(res.status).toBe(404);
      expect(res.body.token).toBeUndefined();
    },
  );

  it('is a 404 when NODE_ENV is unset entirely', async () => {
    delete process.env.NODE_ENV;
    const res = await request(app).post('/auth/dev-token').send({ role: 'ADMIN' });
    expect(res.status).toBe(404);
  });
});

describe('GET /debug-sentry', () => {
  it('is hidden on a real deployment', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(app).get('/debug-sentry');
    expect(res.status).toBe(404);
  });
});

describe('JWT secret requirement', () => {
  const originalSecret = process.env.JWT_SECRET;
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  function loadAppWith(env: string | undefined, secret: string | undefined) {
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
    jest.isolateModules(() => {
      jest.doMock('../config/sequelize', () => ({ sequelize: { query: async () => [] } }));
      jest.requireActual('../app');
    });
  }

  it.each(['production', 'staging', undefined])(
    'refuses to boot with NODE_ENV=%p and no JWT_SECRET',
    (env) => {
      expect(() => loadAppWith(env, undefined)).toThrow(/JWT_SECRET must be set/);
    },
  );

  it('boots outside local dev when a JWT_SECRET is provided', () => {
    expect(() => loadAppWith('production', 'a-real-secret')).not.toThrow();
  });

  it('may use the built-in dev secret only in local development/test', () => {
    expect(() => loadAppWith('development', undefined)).not.toThrow();
    expect(() => loadAppWith('test', undefined)).not.toThrow();
  });
});
