import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { useAuthStore } from '../../../../src/store/authStore';

// QR-based Check-In (PRD §12.48). The organizer/scorer displays the
// match's check-in code as a QR; a player either scans it with the camera
// (native only — expo-barcode-scanner has no web support, so that path is
// gated to Platform.OS !== 'web') or types the 6-digit code shown under
// the QR as a fallback that always works.
export default function CheckInScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const user = useAuthStore((s) => s.user);
  const [code, setCode] = useState<string | null>(null);
  const [isManager, setIsManager] = useState<boolean | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiClient
      .getGameRoom(matchId)
      .then((room) => {
        const manager =
          room.organizer_id === user?.user_id || room.assigned_scorer_id === user?.user_id;
        setIsManager(manager);
        if (manager) {
          apiClient
            .getCheckInCode(matchId)
            .then((res) => setCode(res.check_in_code))
            .catch(() => setError('Could not load the check-in code.'));
        }
      })
      .catch(() => setIsManager(false));
  }, [matchId, user?.user_id]);

  async function submitCode(value: string) {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.checkIn(matchId, value.trim());
      setSuccess(true);
      setScanning(false);
    } catch (err) {
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Could not check in.');
    } finally {
      setBusy(false);
    }
  }

  async function startScanning() {
    if (Platform.OS === 'web') return;
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setHasCameraPermission(status === 'granted');
    if (status === 'granted') setScanning(true);
  }

  if (isManager === null) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="check-in-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (isManager) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center pt-10" testID="check-in-organizer-screen">
          <Text className="font-ui font-bold text-title-xl text-ink-black text-center mb-2">
            Check-In QR
          </Text>
          <Text className="font-ui text-body text-text-secondary text-center mb-8">
            Players scan this to check in when they arrive.
          </Text>
          {code ? (
            <>
              <View className="bg-surface rounded-lg border border-border-subtle p-6">
                <QRCode value={code} size={200} />
              </View>
              <Text
                className="font-ui font-bold text-title-xl text-brand-red text-center mt-6"
                testID="check-in-code-text"
              >
                {code}
              </Text>
              <Text className="font-ui text-micro text-text-tertiary text-center mt-1">
                Or share this code if scanning isn&apos;t possible.
              </Text>
            </>
          ) : error ? (
            <Text className="text-brand-red text-body text-center">{error}</Text>
          ) : (
            <ActivityIndicator color={colors.brandRed} />
          )}
        </View>
      </ScreenContainer>
    );
  }

  if (success) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="check-in-success">
          <Feather name="check-circle" size={56} color="#D80000" />
          <Text className="font-ui font-bold text-title-xl text-ink-black text-center mt-4">
            You&apos;re Checked In
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View className="pt-6" testID="check-in-player-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black">Check In</Text>
        <Text className="font-ui text-body text-text-secondary mt-2 mb-6">
          Scan the organizer&apos;s QR, or enter the code they show you.
        </Text>

        {Platform.OS !== 'web' && (
          <View className="mb-6">
            {!scanning ? (
              <Button
                label="Scan QR Code"
                iconLeft={<Feather name="camera" size={16} color="#FFFFFF" />}
                onPress={startScanning}
                testID="start-scan-button"
              />
            ) : (
              <View
                className="rounded-lg overflow-hidden"
                style={{ height: 280 }}
                testID="scanner-view"
              >
                <BarCodeScanner
                  onBarCodeScanned={({ data }) => submitCode(data)}
                  style={{ flex: 1 }}
                />
              </View>
            )}
            {hasCameraPermission === false && (
              <Text className="text-brand-red text-body mt-2">
                Camera permission denied — enter the code manually below.
              </Text>
            )}
          </View>
        )}

        <TextField
          label="Check-In Code"
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="6-digit code"
          keyboardType="number-pad"
          maxLength={6}
          testID="manual-code-input"
        />
        {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}
        <Button
          label="Check In"
          onPress={() => submitCode(manualCode)}
          loading={busy}
          testID="submit-manual-code"
        />
      </View>
    </ScreenContainer>
  );
}
