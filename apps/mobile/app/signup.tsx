import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AuthScreenBackground } from '../src/components/AuthScreenBackground';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { useSignupStore } from '../src/store/signupStore';

export default function Signup() {
  const router = useRouter();
  const setPhonePasswordSignup = useSignupStore((s) => s.setPhonePasswordSignup);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);

    if (!identifier || !password) {
      setError('Enter a phone number and a password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setPhonePasswordSignup(identifier, password);
    router.push({
      pathname: '/otp-verification',
      params: { identifier, purpose: 'SIGNUP' },
    });
  }

  return (
    <AuthScreenBackground scroll>
      <View className="items-center mt-12 mb-6">
        <Text className="font-display text-hero text-brand-red">BFAM</Text>
        <Text className="font-ui text-micro uppercase tracking-widest text-text-secondary mt-1">
          Play. Compete. Repeat.
        </Text>
        <View className="h-0.5 w-8 bg-brand-red mt-2" />
      </View>

      <View className="flex-row items-center justify-center mb-8">
        <View className="h-px w-8 bg-brand-red" />
        <Text className="font-ui font-bold text-section-header text-ink-black uppercase tracking-wide mx-3">
          Sign Up
        </Text>
        <View className="h-px w-8 bg-brand-red" />
      </View>

      <TextField
        label="Phone Number"
        placeholder="Enter your phone number"
        value={identifier}
        onChangeText={setIdentifier}
        keyboardType="phone-pad"
        testID="signup-identifier"
        iconLeft={<Feather name="smartphone" size={18} color="#D80000" />}
      />
      <TextField
        label="Password"
        placeholder="Create a password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!passwordVisible}
        testID="signup-password"
        iconLeft={<Feather name="lock" size={18} color="#D80000" />}
        rightAction={
          <Pressable
            onPress={() => setPasswordVisible((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
          >
            <Feather name={passwordVisible ? 'eye-off' : 'eye'} size={18} color="#767676" />
          </Pressable>
        }
      />
      <TextField
        label="Confirm Password"
        placeholder="Confirm your password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={!confirmVisible}
        testID="signup-confirm-password"
        iconLeft={<Feather name="lock" size={18} color="#D80000" />}
        rightAction={
          <Pressable
            onPress={() => setConfirmVisible((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={confirmVisible ? 'Hide password' : 'Show password'}
          >
            <Feather name={confirmVisible ? 'eye-off' : 'eye'} size={18} color="#767676" />
          </Pressable>
        }
      />

      {error ? (
        <Text className="font-ui text-body text-brand-red-dark mt-2 mb-2" testID="signup-error">
          {error}
        </Text>
      ) : null}

      <View className="mt-4 mb-6">
        <Button
          label="Continue"
          onPress={handleSubmit}
          testID="signup-submit"
          iconRight={<Feather name="arrow-right" size={18} color="#FFFFFF" />}
        />
      </View>

      <View className="flex-row justify-center mb-10">
        <Text className="font-ui text-body text-text-secondary">Already have an account? </Text>
        <Text
          className="font-ui text-body font-bold text-brand-red"
          onPress={() => router.push('/login')}
        >
          Log in
        </Text>
      </View>
    </AuthScreenBackground>
  );
}
