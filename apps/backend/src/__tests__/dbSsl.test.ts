// Azure Database for MySQL (and other managed MySQL) refuses unencrypted
// connections. TLS is opt-in so local MySQL / private-network databases keep
// working unchanged.

import { getDbSslOptions } from '../config/dbSsl';

describe('getDbSslOptions', () => {
  it('is off by default', () => {
    expect(getDbSslOptions({})).toBeUndefined();
    expect(getDbSslOptions({ DB_SSL: '' })).toBeUndefined();
    expect(getDbSslOptions({ DB_SSL: 'false' })).toBeUndefined();
    expect(getDbSslOptions({ DB_SSL: '0' })).toBeUndefined();
  });

  it.each(['true', 'TRUE', '1', 'yes', 'require'])(
    'turns on for DB_SSL=%s, verifying the certificate',
    (v) => {
      expect(getDbSslOptions({ DB_SSL: v })).toEqual({ rejectUnauthorized: true });
    },
  );

  it('only skips certificate verification when explicitly told to', () => {
    expect(getDbSslOptions({ DB_SSL: 'true', DB_SSL_REJECT_UNAUTHORIZED: 'false' })).toEqual({
      rejectUnauthorized: false,
    });
    expect(getDbSslOptions({ DB_SSL: 'true', DB_SSL_REJECT_UNAUTHORIZED: 'true' })).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('accepts a CA as inline PEM (with \n escapes) or as base64', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----';
    expect(getDbSslOptions({ DB_SSL: 'true', DB_SSL_CA: pem.replace(/\n/g, '\n') })?.ca).toBe(pem);
    expect(
      getDbSslOptions({ DB_SSL: 'true', DB_SSL_CA_BASE64: Buffer.from(pem).toString('base64') })
        ?.ca,
    ).toBe(pem);
  });

  it('ignores CA settings when TLS is off', () => {
    expect(
      getDbSslOptions({ DB_SSL_CA: 'x', DB_SSL_REJECT_UNAUTHORIZED: 'false' }),
    ).toBeUndefined();
  });
});
