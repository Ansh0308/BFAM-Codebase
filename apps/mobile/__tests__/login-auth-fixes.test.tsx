import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

const mockLogin = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    login: (...args: unknown[]) => mockLogin(...args),
    forgotPassword: jest.fn(),
  },
}));

jest.mock('../src/services/socialAuth', () => ({
  useGoogleSignIn: () => ({ request: null, response: null, promptAsync: jest.fn() }),
  extractGoogleIdToken: () => null,
  signInWithApple: jest.fn(),
}));

import Login from '../app/login';
import ForgotPassword from '../app/forgot-password';

// S-2: the brother's "BFAM_issues" sheet flagged the wrong-password error
// as saying "invalid identifier or password" instead of a clear,
// user-facing "invalid username or password".
describe('Login screen — error text (backlog S-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Invalid username or password." on a failed login, not "invalid identifier"', async () => {
    mockLogin.mockRejectedValueOnce(new Error('unauthorized'));

    const { findByTestId, findByText } = await render(<Login />);
    fireEvent.changeText(await findByTestId('login-identifier'), 'player@example.com');
    fireEvent.changeText(await findByTestId('login-password'), 'wrong-password');
    fireEvent.press(await findByTestId('login-submit'));

    expect(await findByText('Invalid username or password.')).toBeTruthy();
  });
});

// S-3: "Move the Forgot Password link below the Password field" — it used
// to sit at the very bottom of the screen, several sections after
// Password.
function collectStrings(node: unknown, out: string[]): void {
  if (node == null) return;
  if (typeof node === 'string') {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectStrings(child, out);
    return;
  }
  if (typeof node === 'object' && 'children' in (node as Record<string, unknown>)) {
    collectStrings((node as { children: unknown }).children, out);
  }
}

describe('Login screen — Forgot Password link placement (backlog S-3)', () => {
  it('places "Forgot password?" directly after the Password field, before the Log In button', async () => {
    const { findByText, getByTestId, toJSON } = await render(<Login />);
    await findByText('Forgot password?');

    // Walk the rendered tree in document order and confirm Password comes
    // right before Forgot Password, which comes before the "Or" divider —
    // not after the social-login buttons or the sign-up prompt at the
    // very bottom of the screen (where it used to sit).
    const allText: string[] = [];
    collectStrings(toJSON(), allText);

    const passwordIdx = allText.indexOf('Password');
    const forgotIdx = allText.indexOf('Forgot password?');
    const orIdx = allText.indexOf('Or');

    expect(passwordIdx).toBeGreaterThanOrEqual(0);
    expect(forgotIdx).toBeGreaterThan(passwordIdx);
    expect(orIdx).toBeGreaterThan(forgotIdx);
    expect(getByTestId('login-submit')).toBeTruthy();
  });
});

// S-4: "Add a Back button on the Forgot Password screen" — it used to have
// no way back except a hardware/swipe gesture.
describe('Forgot Password screen — Back button (backlog S-4)', () => {
  it('has a working back button', async () => {
    const { findByTestId } = await render(<ForgotPassword />);

    fireEvent.press(await findByTestId('screen-header-back'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
