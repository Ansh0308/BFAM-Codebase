import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// A dark bottom sheet for the scoring screen's quick pickers (openers,
// next batter, bowler, wicket type, more runs). Tapping the backdrop closes
// it without choosing.
export function ScoringSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root} testID={testID}>
        <Pressable style={styles.backdrop} onPress={onClose} testID={`${testID}-backdrop`} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function SheetOption({
  label,
  sub,
  onPress,
  testID,
  selected,
  disabled,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  testID?: string;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.option, selected && styles.optionSelected, disabled && { opacity: 0.35 }]}
      testID={testID}
    >
      <Text style={styles.optionLabel}>{label}</Text>
      {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#1B1B1B',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#555555',
    marginBottom: 16,
  },
  title: { fontFamily: 'Inter-Bold', fontSize: 24, color: '#FFFFFF' },
  subtitle: { fontFamily: 'Inter', fontSize: 14, color: '#9A9A9A', marginTop: 4, marginBottom: 8 },
  option: {
    backgroundColor: '#262626',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  optionSelected: { borderColor: '#D80000', backgroundColor: '#3A1414' },
  optionLabel: { fontFamily: 'Inter-Bold', fontSize: 17, color: '#FFFFFF' },
  optionSub: { fontFamily: 'Inter', fontSize: 12, color: '#9A9A9A', marginTop: 2 },
});
