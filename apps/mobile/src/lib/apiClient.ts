import { BFAMApiClient } from '@bfam/api-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// Single shared client instance for the whole app. `useAuthStore` calls
// `setToken`/`clearToken` on this instance whenever auth state changes.
export const apiClient = new BFAMApiClient(API_URL);
