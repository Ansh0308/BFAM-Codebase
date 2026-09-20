import { BFAMApiError } from '@bfam/api-client';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    setToken: jest.fn(),
    clearToken: jest.fn(),
    getCurrentUser: jest.fn(),
  },
}));

jest.mock('../src/lib/pushNotifications', () => ({
  registerForPushNotifications: jest.fn(),
}));

const mockGetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();
jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: jest.fn(),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';

const mockSetToken = apiClient.setToken as jest.Mock;
const mockClearToken = apiClient.clearToken as jest.Mock;
const mockGetCurrentUser = apiClient.getCurrentUser as jest.Mock;

const STORED_USER = { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' };

// A stale/expired JWT (SecureStore/localStorage) used to be trusted blindly
// on every launch — app/index.tsx routes straight past Login the instant a
// token exists in the store, with nothing checking it's still valid. That
// meant reopening the app after the 1h token lifetime sailed past Login
// into the tab bar, only to 401 with a raw "Invalid bearer token" on the
// first API call, on every single launch until someone manually cleared
// storage. hydrate() now validates before trusting a persisted session.
describe('authStore.hydrate — validates a persisted token instead of trusting it blindly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ token: null, user: null, isHydrating: true });
  });

  it('restores the session when the stored token is still valid', async () => {
    mockGetItemAsync.mockImplementation((key: string) =>
      Promise.resolve(key === 'bfam_auth_token' ? 'valid-token' : JSON.stringify(STORED_USER)),
    );
    mockGetCurrentUser.mockResolvedValue({ user_id: 'u1' });

    await useAuthStore.getState().hydrate();

    expect(mockSetToken).toHaveBeenCalledWith('valid-token');
    expect(useAuthStore.getState()).toMatchObject({
      token: 'valid-token',
      user: STORED_USER,
      isHydrating: false,
    });
    expect(mockClearToken).not.toHaveBeenCalled();
  });

  it('clears the session instead of restoring an expired/invalid token', async () => {
    mockGetItemAsync.mockImplementation((key: string) =>
      Promise.resolve(key === 'bfam_auth_token' ? 'expired-token' : JSON.stringify(STORED_USER)),
    );
    mockGetCurrentUser.mockRejectedValue(new BFAMApiError('Invalid bearer token', 401));

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      user: null,
      isHydrating: false,
    });
    expect(mockClearToken).toHaveBeenCalled();
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('bfam_auth_token');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('bfam_auth_user');
  });

  it('starts logged out when nothing is stored', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    await useAuthStore.getState().hydrate();

    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null, isHydrating: false });
  });
});
