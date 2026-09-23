import { BFAMApiClient } from '@bfam/api-client';
import { getApiBaseUrl } from './apiBaseUrl';

// Single shared BFAMApiClient instance for the whole app. The dev/staging/
// prod URL is injected via EXPO_PUBLIC_API_URL (see .env.example) for
// native — Expo inlines EXPO_PUBLIC_* vars at build time — but web derives
// it from the page's own origin instead; see getApiBaseUrl for why.
export const apiClient = new BFAMApiClient(getApiBaseUrl());
