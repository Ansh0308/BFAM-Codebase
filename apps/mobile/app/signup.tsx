import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { AuthScreenBackground } from '../src/components/AuthScreenBackground';
import { SignupHero } from '../src/components/SignupHero';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
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

// A password requirement checked off as the user types — gray until met,
// then switches to brand red so progress reads at a glance without a big
// validation panel.
function Requirement({ label, met }: { label: string; met: boolean }) {
  return (
    <View className="flex-row items-center mr-3 mb-1">
      <Feather
        name={met ? 'check-circle' : 'circle'}
        size={12}
        color={met ? '#D80000' : '#CCCCCC'}
      />
      <Text
        className={[
          'font-ui text-micro ml-1',
          met ? 'text-brand-red font-bold' : 'text-text-tertiary',
        ].join(' ')}
      >
        {label}
      </Text>
    </View>
  );
}

export default function Signup() {
  const router = useRouter();
  const setPhonePasswordSignup = useSignupStore((s) => s.setPhonePasswordSignup);
  const setSession = useAuthStore((s) => s.setSession);
  const setSocialTicket = useSignupStore((s) => s.setSocialTicket);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUppercase = /[A-Z]/.test(password);

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

  function handleSubmit() {
    setError(null);

    if (!identifier) {
      setError('Enter a valid phone number.');
      return;
    }
    if (!hasMinLength) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setPhonePasswordSignup(identifier, password);
    setSuccess(true);
    setTimeout(() => {
      router.push({
        pathname: '/otp-verification',
        params: { identifier, purpose: 'SIGNUP' },
      });
    }, 450);
  }

  return (
    <AuthScreenBackground scroll avoidKeyboard>
      <SignupHero />

      <View style={{ marginTop: 8 }}>
        <Reveal delay={140}>
          <TextField
            label="Phone Number"
            uppercaseLabel={false}
            placeholder="Enter your phone number"
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType="phone-pad"
            testID="signup-identifier"
            iconLeft={<Feather name="smartphone" size={18} />}
          />
        </Reveal>

        <Reveal delay={180}>
          <TextField
            label="Password"
            uppercaseLabel={false}
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            textContentType="newPassword"
            testID="signup-password"
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

        {password.length > 0 ? (
          <View className="flex-row flex-wrap mb-3" style={{ marginTop: -12 }}>
            <Requirement label="8+ characters" met={hasMinLength} />
            <Requirement label="Number" met={hasNumber} />
            <Requirement label="Uppercase" met={hasUppercase} />
          </View>
        ) : null}

        <Reveal delay={220}>
          <TextField
            label="Confirm Password"
            uppercaseLabel={false}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!confirmVisible}
            textContentType="newPassword"
            testID="signup-confirm-password"
            iconLeft={<Feather name="lock" size={18} />}
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
        </Reveal>

        {error ? (
          <View className="flex-row items-center bg-status-danger-bg rounded-md px-3 py-2 mb-4">
            <Feather name="alert-circle" size={14} color="#A80000" />
            <Text
              className="font-ui text-micro text-status-danger ml-2 flex-1"
              testID="signup-error"
            >
              {error}
            </Text>
          </View>
        ) : null}
      </View>

      <Reveal delay={260}>
        <View className="mt-2 mb-6">
          <Button
            label="Continue"
            onPress={handleSubmit}
            success={success}
            successLabel="Account Created"
            testID="signup-submit"
            iconRight={
              success ? undefined : <Feather name="arrow-right" size={18} color="#FFFFFF" />
            }
          />
        </View>
      </Reveal>

      <Reveal delay={300}>
        <View className="flex-row items-center mb-6">
          <View className="flex-1 h-px bg-border-strong" />
          <Text className="font-ui text-micro uppercase tracking-widest text-text-tertiary mx-3">
            Or
          </Text>
          <View className="flex-1 h-px bg-border-strong" />
        </View>

        <View className="mb-3">
          <Button
            label="Continue with Google"
            variant="secondary"
            disabled={!googleRequest || loading}
            onPress={() => googlePromptAsync()}
            iconLeft={<FontAwesome name="google" size={18} color="#111111" />}
          />
        </View>
        <Button
          label="Continue with Apple"
          variant="secondary"
          disabled={loading}
          onPress={handleAppleSignIn}
          iconLeft={<FontAwesome name="apple" size={18} color="#0D0D0D" />}
        />
      </Reveal>

      <Reveal delay={340}>
        <View className="flex-row justify-center mt-8 mb-10">
          <Text className="font-ui text-body text-text-secondary">Already have an account? </Text>
          <Text
            className="font-ui text-body font-bold text-brand-red"
            onPress={() => router.push('/login')}
          >
            Log in
          </Text>
        </View>
      </Reveal>
    </AuthScreenBackground>
  );
}
