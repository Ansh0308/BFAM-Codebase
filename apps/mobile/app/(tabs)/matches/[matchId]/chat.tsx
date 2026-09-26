import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { BallLoader } from '../../../../src/components/BallLoader';
import { useLocalSearchParams } from 'expo-router';
import type { ChatMessage } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { ScreenHeader } from '../../../../src/components/ScreenHeader';
import { TextField } from '../../../../src/components/TextField';
import { Button } from '../../../../src/components/Button';
import { useAuthStore } from '../../../../src/store/authStore';
import { getSocket, joinMatchRoom, leaveMatchRoom } from '../../../../src/lib/socket';

// Backlog A-9: same full_name-falls-back-to-bfam_id convention used
// everywhere else a player is shown.
function senderName(m: ChatMessage): string {
  return m.sender_full_name || m.sender_bfam_id || 'Someone';
}

// Match Chat (backlog B-3): one room per match — full history loaded on
// open, then kept live over the same Socket.IO connection used for live
// scoring/intro sync (module 2.7/2.8), joining/leaving the same
// `match:{matchId}` room those screens use. System messages (check-in,
// confirmation) arrive the same way as player messages, distinguished
// only by message_type for styling.
export default function MatchChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const userId = useAuthStore((s) => s.user?.user_id);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { results } = await apiClient.getMatchMessages(matchId);
      setMessages(results);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not load this chat.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
    joinMatchRoom(matchId);

    const socket = getSocket();
    function onMessage(payload: { matchId: string; message: ChatMessage }) {
      if (payload.matchId !== matchId) return;
      setMessages((prev) => [...prev, payload.message]);
    }
    socket.on('match:chat_message', onMessage);

    return () => {
      socket.off('match:chat_message', onMessage);
      leaveMatchRoom(matchId);
    };
  }, [matchId, load]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await apiClient.sendMatchMessage(matchId, body);
      setDraft('');
      // The socket broadcast also delivers this same message back to the
      // sender — relying on that (rather than appending optimistically
      // here too) keeps a single source of truth for what's actually in
      // the room, with no risk of a duplicated bubble.
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not send that message.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <BallLoader testID="chat-loading" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        <ScreenHeader title="Match Chat" />

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.message_id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          testID="chat-message-list"
          renderItem={({ item }) => {
            if (item.message_type === 'SYSTEM') {
              return (
                <View className="items-center my-2" testID={`chat-message-${item.message_id}`}>
                  <Text className="font-ui text-micro text-text-tertiary text-center">
                    {item.body}
                  </Text>
                </View>
              );
            }
            const isMine = item.sender_id === userId;
            return (
              <View
                className={`mb-3 max-w-[80%] ${isMine ? 'self-end items-end' : 'self-start items-start'}`}
                testID={`chat-message-${item.message_id}`}
              >
                {!isMine && (
                  <Text className="font-ui text-micro text-text-tertiary mb-0.5">
                    {senderName(item)}
                  </Text>
                )}
                <View
                  className={`rounded-lg px-3 py-2 ${isMine ? 'bg-brand-red' : 'bg-surface-alt'}`}
                >
                  <Text className={`font-ui text-body ${isMine ? 'text-white' : 'text-ink-black'}`}>
                    {item.body}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text
              className="font-ui text-body text-text-secondary text-center mt-8"
              testID="chat-empty"
            >
              No messages yet — say hello!
            </Text>
          }
        />

        {error && <Text className="text-brand-red text-body mb-2">{error}</Text>}

        <View className="flex-row items-end mt-2 mb-4">
          <View className="flex-1 mr-2">
            <TextField
              label=""
              value={draft}
              onChangeText={setDraft}
              placeholder="Message the team…"
              testID="chat-input"
            />
          </View>
          <Button
            label="Send"
            onPress={send}
            loading={sending}
            fullWidth={false}
            disabled={!draft.trim()}
            testID="chat-send-button"
          />
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
