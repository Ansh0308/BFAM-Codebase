import React, { useRef, useState } from 'react';
import { View, TextInput, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  testID?: string;
}

// 6-digit (default) OTP entry: one box per digit, auto-advances focus on
// entry and on backspace. `value`/`onChange` are the single source of
// truth (a plain string of digits) so the parent screen owns validation/
// submission state. Empty boxes show a "–" placeholder and the focused box
// gets a brand-red border, matching the premium reference design.
export function OtpInput({ length = 6, value, onChange, error = false, testID }: OtpInputProps) {
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  function handleChangeDigit(index: number, text: string) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <View className="flex-row justify-between" testID={testID}>
      {digits.map((digit, index) => {
        const isFocused = focusedIndex === index;
        return (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            testID={`${testID ?? 'otp-input'}-${index}`}
            value={digit}
            placeholder="–"
            placeholderTextColor="#767676"
            onChangeText={(text) => handleChangeDigit(index, text)}
            onKeyPress={(e) => handleKeyPress(index, e)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex((current) => (current === index ? null : current))}
            keyboardType="number-pad"
            maxLength={1}
            className={[
              'font-ui text-card-title text-center bg-surface rounded-md border',
              error
                ? 'border-brand-red-dark'
                : isFocused
                  ? 'border-brand-red'
                  : 'border-border-strong',
            ].join(' ')}
            style={{ width: 44, height: 48, color: '#111111' }}
          />
        );
      })}
    </View>
  );
}
