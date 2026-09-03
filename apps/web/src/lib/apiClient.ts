import { BFAMApiClient } from '@bfam/api-client';

// Single shared BFAMApiClient instance for the whole web app — same class
// the mobile app uses (apps/mobile/src/lib/apiClient.ts), so Owner Web/
// Staff Web call the identical backend endpoints as Owner/Staff Mobile
// (module 2.12 requirement 6): no parallel business logic implemented
// separately for web.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export const apiClient = new BFAMApiClient(API_URL);
