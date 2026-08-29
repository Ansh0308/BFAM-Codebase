import { BFAMApiClient } from '@bfam/api-client';

// Single shared BFAMApiClient instance for the whole app. The dev/staging/
// prod URL is injected via EXPO_PUBLIC_API_URL (see .env.example) — Expo
// inlines EXPO_PUBLIC_* vars at build time, so no runtime config needed.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

export const apiClient = new BFAMApiClient(API_URL);
