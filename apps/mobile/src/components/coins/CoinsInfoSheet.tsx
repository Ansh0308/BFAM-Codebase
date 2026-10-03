import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { PillButton } from '../hub/HubParts';
import { CoinsExplainer } from './CoinsExplainer';

// Opens from the coin pill on Home and Matches: a plain-language answer to "what are these
// coins, how do I get them and what are they for", with a shortcut to the Rewards list.
export function CoinsInfoSheet({
  visible,
  balance,
  onClose,
}: {
  visible: boolean;
  balance: number;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityLabel="Close"
          testID="coins-sheet-backdrop"
        />
        <View
          style={{
            maxHeight: '88%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 10,
          }}
          testID="coins-sheet"
        >
          <View className="items-center" style={{ marginBottom: 6 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDDDD' }} />
          </View>
          <View className="flex-row items-center justify-between px-5" style={{ paddingTop: 6 }}>
            <View>
              <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 20 }}>
                BFAM Coins
              </Text>
              <Text className="font-ui text-text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
                You have <Text className="font-bold text-brand-red">{balance}</Text> coin
                {balance === 1 ? '' : 's'} (worth ₹{balance})
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close coins info"
              testID="coins-sheet-close"
            >
              <Feather name="x" size={24} color={colors.inkBlack} />
            </Pressable>
          </View>
          <ScrollView
            className="px-5"
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 12 }}
            testID="coins-sheet-scroll"
          >
            <CoinsExplainer />
          </ScrollView>
          <View className="px-5" style={{ paddingTop: 4, paddingBottom: 26 }}>
            <PillButton
              label="See rewards"
              icon="gift"
              onPress={() => {
                onClose();
                router.push('/rewards');
              }}
              testID="coins-sheet-rewards"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
