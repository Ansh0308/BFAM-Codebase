import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { AuthScreenBackground } from '../src/components/AuthScreenBackground';
import { LoginHero } from '../src/components/LoginHero';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { LoadingOverlay } from '../src/components/LoadingOverlay';
import { Reveal } from '../src/components/Reveal';
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
  const [loginSuccess, setLoginSuccess] = useState(false);

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
      setLoading(false);
      setLoginSuccess(true);
      setTimeout(() => router.replace('/session-active'), 450);
    } catch {
      setError('Invalid identifier or password.');
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <AuthScreenBackground scroll avoidKeyboard>
        <LoginHero />

        <View className="mt-7">
          <Reveal delay={130}>
            <TextField
              label="Phone or Email"
              placeholder="Enter phone or email"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoComplete="username"
              testID="login-identifier"
              iconLeft={<Feather name="user" size={18} />}
            />
          </Reveal>
          <Reveal delay={170}>
            <TextField
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              autoComplete="password"
              textContentType="password"
              testID="login-password"
              iconLeft={<Feather name="lock" size={18} />}
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
          </Reveal>

          <Reveal delay={190}>
            <View className="items-end mb-4" style={{ marginTop: -8 }}>
              <Text
                className="font-ui text-micro font-bold text-brand-red"
                onPress={() => router.push('/forgot-password')}
              >
                Forgot password?
              </Text>
            </View>
          </Reveal>

          {error ? (
            <View className="flex-row items-center bg-status-danger-bg rounded-md px-3 py-2 mb-4">
              <Feather name="alert-circle" size={14} color="#A80000" />
              <Text className="font-ui text-micro text-status-danger ml-2 flex-1">{error}</Text>
            </View>
          ) : null}

          <Reveal delay={220}>
            <Button
              label="Log In"
              onPress={handleLogin}
              loading={loading}
              success={loginSuccess}
              testID="login-submit"
              iconRight={
                loginSuccess ? undefined : <Feather name="arrow-right" size={18} color="#FFFFFF" />
              }
            />
          </Reveal>

          <Reveal delay={260}>
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
                router.push({
                  pathname: '/otp-verification',
                  params: { mode: 'send', purpose: 'LOGIN' },
                })
              }
              iconLeft={<Feather name="smartphone" size={18} color="#D80000" />}
            />
          </Reveal>

          <Reveal delay={300}>
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
          </Reveal>

          <Reveal delay={340}>
            <View className="flex-row justify-center mt-8 mb-8">
              <Text className="font-ui text-body text-text-secondary">New to BFAM? </Text>
              <Text
                className="font-ui text-body font-bold text-brand-red"
                onPress={() => router.push('/signup')}
              >
                Sign up
              </Text>
            </View>
          </Reveal>
        </View>
      </AuthScreenBackground>
      {loading ? <LoadingOverlay label="Logging in..." /> : null}
    </View>
  );
}
