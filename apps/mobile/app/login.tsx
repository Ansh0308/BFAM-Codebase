import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { AuthScreenBackground } from '../src/components/AuthScreenBackground';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import { useSignupStore } from '../src/store/signupStore';
import { useGoogleSignIn, extractGoogleIdToken, signInWithApple } from '../src/services/socialAuth';
import { SocialTicketResponse, AuthSuccessResponse } from '@bfam/shared-types';

function isSocialTicketResponse(
  body: AuthSuccessResponse | SocialTicketResponse,
): body is SocialTicketResponse {
  return 'social_ticket' in body;
}

export default function Login() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const setSocialTicket = useSignupStore((s) => s.setSocialTicket);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    request: googleRequest,
    response: googleResponse,
    promptAsync: googlePromptAsync,
  } = useGoogleSignIn();

  React.useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = extractGoogleIdToken(googleResponse);
      if (idToken) handleGoogleToken(idToken);
    }
  }, [googleResponse]);

  async function handleAuthSuccessOrTicket(body: AuthSuccessResponse | SocialTicketResponse) {
    if (isSocialTicketResponse(body)) {
      setSocialTicket(body.social_ticket, body.email ?? null);
      router.push('/social-phone');
      return;
    }
    await setSession(body.token, { user_id: body.user_id, bfam_id: body.bfam_id, role: body.role });
    router.replace('/session-active');
  }

  async function handleGoogleToken(idToken: string) {
    setError(null);
    setLoading(true);
    try {
      const body = await apiClient.googleAuth(idToken);
      await handleAuthSuccessOrTicket(body);
    } catch {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const { identityToken, fullName } = await signInWithApple();
      const body = await apiClient.appleAuth(identityToken, fullName);
      await handleAuthSuccessOrTicket(body);
    } catch {
      setError('Apple sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setError(null);
    if (!identifier || !password) {
      setError('Enter your phone/email and password.');
      return;
    }
    setLoading(true);
    try {
      const body = await apiClient.login(identifier, password);
      await setSession(body.token, {
        user_id: body.user_id,
        bfam_id: body.bfam_id,
        role: body.role,
      });
      router.replace('/session-active');
    } catch {
      setError('Invalid identifier or password.');
    } finally {
      setLoading(false);
    }
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
        <Text className="font-display text-section-header text-ink-black uppercase mx-3">
          Log In
        </Text>
        <View className="h-px w-8 bg-brand-red" />
      </View>

      <TextField
        label="Phone or Email"
        placeholder="Enter phone or email"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        testID="login-identifier"
        iconLeft={<Feather name="user" size={18} color="#D80000" />}
      />
      <TextField
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!passwordVisible}
        testID="login-password"
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

      {error ? <Text className="font-ui text-body text-brand-red-dark mb-4">{error}</Text> : null}

      <Button
        label="Log In"
        onPress={handleLogin}
        loading={loading}
        testID="login-submit"
        iconRight={<Feather name="arrow-right" size={18} color="#FFFFFF" />}
      />

      <View className="flex-row items-center my-6">
        <View className="flex-1 h-px bg-border-strong" />
        <Text className="font-ui text-micro uppercase tracking-widest text-text-tertiary mx-3">
          Or
        </Text>
        <View className="flex-1 h-px bg-border-strong" />
      </View>

      <Button
        label="Log in with OTP instead"
        variant="ghost"
        onPress={() =>
          router.push({ pathname: '/otp-verification', params: { mode: 'send', purpose: 'LOGIN' } })
        }
        iconLeft={<Feather name="smartphone" size={18} color="#D80000" />}
      />

      <View className="mt-3">
        <Button
          label="Continue with Google"
          variant="secondary"
          disabled={!googleRequest}
          onPress={() => googlePromptAsync()}
          iconLeft={<FontAwesome name="google" size={18} color="#111111" />}
        />
      </View>
      <View className="mt-3">
        <Button
          label="Continue with Apple"
          variant="secondary"
          onPress={handleAppleSignIn}
          iconLeft={<FontAwesome name="apple" size={18} color="#0D0D0D" />}
        />
      </View>

      <View className="flex-row justify-center mt-8 mb-2">
        <Text className="font-ui text-body text-text-secondary">New to BFAM? </Text>
        <Text
          className="font-ui text-body font-bold text-brand-red"
          onPress={() => router.push('/signup')}
        >
          Sign up
        </Text>
      </View>
      <View className="items-center mb-8">
        <Text
          className="font-ui text-body text-text-tertiary"
          onPress={() => router.push('/forgot-password')}
        >
          Forgot password?
        </Text>
      </View>
    </AuthScreenBackground>
  );
}
