import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockLogin = jest.fn();
jest.mock('../src/lib/auth', () => {
  class BFAMApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return { useAuth: () => ({ login: mockLogin }), BFAMApiError };
});

import { BFAMApiError } from '../src/lib/auth';
import LoginPage from '../src/app/login/page';

function fill(id: string, pw: string) {
  fireEvent.change(screen.getByTestId('login-identifier'), { target: { value: id } });
  fireEvent.change(screen.getByTestId('login-password'), { target: { value: pw } });
  fireEvent.click(screen.getByTestId('login-submit'));
}

describe('Web login', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockReplace.mockReset();
  });

  it.each([
    ['TURF_OWNER', '/owner'],
    ['TURF_STAFF', '/staff'],
    ['ADMIN', '/admin'],
  ])('sends a %s to %s after signing in', async (role, path) => {
    mockLogin.mockResolvedValue({ user_id: 'u', role });
    render(<LoginPage />);
    fill('9876543210', 'secret');

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('9876543210', 'secret'));
    expect(await screen.findByTestId('login-welcome')).toBeInTheDocument();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(path));
  });

  it('shows the server’s message when the credentials are wrong', async () => {
    mockLogin.mockRejectedValue(new BFAMApiError('Invalid identifier or password', 401));
    render(<LoginPage />);
    fill('9876543210', 'nope');

    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'Invalid identifier or password',
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('turns players away with a clear message', async () => {
    mockLogin.mockResolvedValue({ user_id: 'u', role: 'PLAYER' });
    render(<LoginPage />);
    fill('9876543210', 'secret');

    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      /Turf Owner, Turf Staff, and Admin/,
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to a generic message for an unexpected failure', async () => {
    mockLogin.mockRejectedValue(new Error('network'));
    render(<LoginPage />);
    fill('9876543210', 'secret');
    expect(await screen.findByTestId('login-error')).toHaveTextContent('Could not sign in.');
  });

  it('can reveal and re-hide the password', () => {
    render(<LoginPage />);
    const input = screen.getByTestId('login-password');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByTestId('toggle-password'));
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByTestId('toggle-password'));
    expect(input).toHaveAttribute('type', 'password');
  });
});
