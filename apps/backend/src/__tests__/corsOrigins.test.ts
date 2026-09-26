// The browser-facing origins allowed to call the API (REST and Socket.IO).

import { getAllowedOrigins } from '../config/env';

describe('getAllowedOrigins', () => {
  it('allows any origin when CORS_ORIGIN is unset or blank (local development)', () => {
    expect(getAllowedOrigins({})).toBe(true);
    expect(getAllowedOrigins({ CORS_ORIGIN: '' })).toBe(true);
    expect(getAllowedOrigins({ CORS_ORIGIN: ' , ,' })).toBe(true);
  });

  it('turns a comma-separated list into an allowlist', () => {
    expect(
      getAllowedOrigins({ CORS_ORIGIN: 'https://app.example.com,https://admin.example.com' }),
    ).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  it('tolerates spaces and trailing slashes, which are easy to paste in by mistake', () => {
    expect(
      getAllowedOrigins({ CORS_ORIGIN: ' https://app.example.com/ ,https://admin.example.com// ' }),
    ).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });
});
