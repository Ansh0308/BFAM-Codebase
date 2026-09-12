import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { user_id: string } }) => unknown) =>
    selector({ user: { user_id: 'me-user' } }),
}));

const mockSocketOn = jest.fn();
const mockSocketOff = jest.fn();
const mockJoinMatchRoom = jest.fn();
const mockLeaveMatchRoom = jest.fn();
jest.mock('../src/lib/socket', () => ({
  getSocket: () => ({ on: mockSocketOn, off: mockSocketOff, emit: jest.fn() }),
  joinMatchRoom: (...args: unknown[]) => mockJoinMatchRoom(...args),
  leaveMatchRoom: (...args: unknown[]) => mockLeaveMatchRoom(...args),
}));

const mockGetMatchMessages = jest.fn();
const mockSendMatchMessage = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMatchMessages: (...args: unknown[]) => mockGetMatchMessages(...args),
    sendMatchMessage: (...args: unknown[]) => mockSendMatchMessage(...args),
  },
}));

import MatchChatScreen from '../app/(tabs)/matches/[matchId]/chat';

const HISTORY = [
  {
    message_id: 'm1',
    match_id: 'match-1',
    sender_id: 'other-user',
    message_type: 'TEXT',
    body: 'Hey team!',
    created_at: '',
    sender_bfam_id: 'BF1002',
    sender_full_name: null,
  },
  {
    message_id: 'm2',
    match_id: 'match-1',
    sender_id: null,
    message_type: 'SYSTEM',
    body: 'Asha Patel checked in.',
    created_at: '',
    sender_bfam_id: null,
    sender_full_name: null,
  },
];

// Backlog B-3: Match Chat.
describe('Match Chat screen (backlog B-3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMatchMessages.mockResolvedValue({ results: HISTORY });
  });

  it('loads and shows the chat history, joining the match room', async () => {
    const { findByTestId } = await render(<MatchChatScreen />);

    await findByTestId('chat-message-m1');
    await findByTestId('chat-message-m2');
    expect(mockJoinMatchRoom).toHaveBeenCalledWith('match-1');
  });

  it('sends a typed message', async () => {
    mockSendMatchMessage.mockResolvedValueOnce({});
    const { findByTestId } = await render(<MatchChatScreen />);

    await fireEvent.changeText(await findByTestId('chat-input'), 'On my way!');
    await fireEvent.press(await findByTestId('chat-send-button'));

    await waitFor(() => expect(mockSendMatchMessage).toHaveBeenCalledWith('match-1', 'On my way!'));
  });

  it('appends a message pushed over the socket in real time', async () => {
    const { findByTestId, queryByTestId } = await render(<MatchChatScreen />);
    await findByTestId('chat-message-m1');

    expect(queryByTestId('chat-message-m3')).toBeNull();

    const onMessageHandler = mockSocketOn.mock.calls.find(
      ([event]) => event === 'match:chat_message',
    )?.[1];
    await act(async () => {
      onMessageHandler?.({
        matchId: 'match-1',
        message: {
          message_id: 'm3',
          match_id: 'match-1',
          sender_id: 'other-user',
          message_type: 'TEXT',
          body: 'New live message',
          created_at: '',
          sender_bfam_id: 'BF1002',
          sender_full_name: null,
        },
      });
    });

    expect(await findByTestId('chat-message-m3')).toBeTruthy();
  });

  it('leaves the match room on unmount', async () => {
    const { findByTestId, unmount } = await render(<MatchChatScreen />);
    await findByTestId('chat-message-m1');

    await unmount();

    expect(mockLeaveMatchRoom).toHaveBeenCalledWith('match-1');
  });

  it('shows an empty state with no messages', async () => {
    mockGetMatchMessages.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = await render(<MatchChatScreen />);

    expect(await findByTestId('chat-empty')).toBeTruthy();
  });
});
