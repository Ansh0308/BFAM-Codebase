// Behind Caddy / Azure / Railway every request comes from the proxy's IP, so
// the login + register rate limiters (keyed on client IP) must be able to see
// the real client via X-Forwarded-For — but only when a proxy is actually
// there (otherwise the header is attacker-controlled).

import { getTrustProxySetting } from '../config/env';

const ORIGINAL = process.env.TRUST_PROXY;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = ORIGINAL;
});

describe('getTrustProxySetting', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['0', false],
    ['false', false],
    ['1', 1],
    ['2', 2],
    ['true', 1],
    ['loopback', 'loopback'],
  ])('TRUST_PROXY=%p -> %p', (value, expected) => {
    if (value === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = value;
    expect(getTrustProxySetting()).toBe(expected);
  });
});

describe('app trust-proxy wiring', () => {
  function loadApp(value: string | undefined) {
    if (value === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = value;
    let loaded: { get: (k: string) => unknown } | undefined;
    jest.isolateModules(() => {
      jest.doMock('../config/sequelize', () => ({ sequelize: { query: async () => [] } }));
      loaded = jest.requireActual('../app').default;
    });
    return loaded!;
  }

  it('does not trust X-Forwarded-For by default', () => {
    expect(loadApp(undefined).get('trust proxy')).toBe(false);
  });

  it('trusts one proxy hop when TRUST_PROXY=1', () => {
    expect(loadApp('1').get('trust proxy')).toBe(1);
  });
});
