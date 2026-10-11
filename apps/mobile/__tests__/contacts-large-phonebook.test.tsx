import { act, renderHook } from '@testing-library/react-native';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../src/lib/apiClient';

// "Could not check your contacts" on a real phone. The server takes at most 2000 numbers per
// request and rejects the whole request if one number is over 30 characters; Android can also
// fail when asked for a big phonebook all at once. The lookup must cope with all of that and
// say what went wrong when it still fails.

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    matchContacts: jest.fn(),
    recordConsent: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockGetContactsAsync = jest.fn();
jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getContactsAsync: (...args: unknown[]) => mockGetContactsAsync(...args),
  Fields: { PhoneNumbers: 'phoneNumbers' },
}));

import { useContactsMatch } from '../src/hooks/useContactsMatch';

const mockMatchContacts = apiClient.matchContacts as jest.Mock;

function contact(n: number, number = String(9000000000 + n)) {
  return { id: `c${n}`, name: `Person ${n}`, phoneNumbers: [{ number }] };
}

describe('useContactsMatch with a real-sized phonebook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchContacts.mockResolvedValue({ results: [] });
  });

  it('reads the phonebook a page at a time and looks numbers up in batches under the limit', async () => {
    const all = Array.from({ length: 1250 }, (_, i) => contact(i));
    mockGetContactsAsync.mockImplementation(
      async ({ pageOffset, pageSize }: { pageOffset: number; pageSize: number }) => ({
        data: all.slice(pageOffset, pageOffset + pageSize),
        hasNextPage: pageOffset + pageSize < all.length,
      }),
    );

    const { result } = await renderHook(() => useContactsMatch());
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.status).toBe('ready');
    expect(mockGetContactsAsync.mock.calls.length).toBeGreaterThan(1);
    const sizes = mockMatchContacts.mock.calls.map((c) => (c[0] as string[]).length);
    expect(sizes).toEqual([500, 500, 250]);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(2000);
    expect(result.current.contacts).toHaveLength(1250);
  });

  it('never sends a number over 30 characters, and skips ones that are not phone numbers', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [
        contact(1, '+91 98765 43210 ext. 12345 (office reception desk)'),
        contact(2, '911'),
        contact(3, '98765 43211'),
      ],
      hasNextPage: false,
    });

    const { result } = await renderHook(() => useContactsMatch());
    await act(async () => {
      await result.current.load();
    });

    const sent = mockMatchContacts.mock.calls.flatMap((c) => c[0] as string[]);
    expect(sent.every((n) => n.length <= 30)).toBe(true);
    expect(sent).toContain('98765 43211');
    expect(sent.some((n) => n === '911')).toBe(false);
    expect(result.current.contacts.map((c) => c.name)).toEqual(['Person 1', 'Person 3']);
  });

  it('lists a number saved twice once', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [contact(1, '98765 43210'), contact(2, '+91 9876543210')],
      hasNextPage: false,
    });
    const { result } = await renderHook(() => useContactsMatch());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.contacts).toHaveLength(1);
  });

  it('says why when the server turns the request down', async () => {
    mockGetContactsAsync.mockResolvedValue({ data: [contact(1)], hasNextPage: false });
    mockMatchContacts.mockRejectedValue(new BFAMApiError('Invalid contacts payload', 400));

    const { result } = await renderHook(() => useContactsMatch());
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('Invalid contacts payload');
  });

  it('tells a signed-out user to log in again', async () => {
    mockGetContactsAsync.mockResolvedValue({ data: [contact(1)], hasNextPage: false });
    mockMatchContacts.mockRejectedValue(new BFAMApiError('Unauthorized', 401));

    const { result } = await renderHook(() => useContactsMatch());
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toMatch(/log in again/i);
  });
});
