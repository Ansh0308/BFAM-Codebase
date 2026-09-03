import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { StaffAssignment } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected — resubmit below',
};

// Staff Verification, step 1 (module 2.12, PRD §32.14): the staff member
// uploads an ID/document for the owner to review. Check-In and Payments
// stay blocked (enforced server-side — see staffService.assertStaffVerified)
// until that review comes back APPROVED.
export default function StaffVerificationScreen() {
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getMyStaffAssignments()
      .then((res) => setAssignments(res.results))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function pickAndUpload(turfId: string) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to submit your document.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    setError(null);
    try {
      await apiClient.submitStaffVerificationDocument(turfId, {
        uri: asset.uri,
        name: `document.${(asset.mimeType ?? 'image/jpeg').split('/')[1]}`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not upload your document.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            testID="staff-verification-loading"
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title="Verification" />
      {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

      {assignments.length === 0 ? (
        <Text className="font-ui text-body text-text-tertiary" testID="staff-verification-empty">
          You are not yet assigned to a turf.
        </Text>
      ) : (
        assignments.map((a) => (
          <View
            key={a.assignment_id}
            className="bg-surface-alt rounded-lg p-4 mb-4"
            testID={`assignment-${a.assignment_id}`}
          >
            <Text className="font-ui font-bold text-body text-text-primary">
              {a.turf_name ?? a.turf_id}
            </Text>
            <Text
              className={`font-ui text-micro uppercase mt-1 ${
                a.verification_status === 'APPROVED' ? 'text-brand-red' : 'text-text-secondary'
              }`}
              testID={`status-${a.assignment_id}`}
            >
              {STATUS_LABEL[a.verification_status]}
            </Text>
            {a.rejection_reason && (
              <Text className="font-ui text-micro text-text-tertiary mt-1">
                {a.rejection_reason}
              </Text>
            )}
            {a.verification_status !== 'APPROVED' && (
              <View className="mt-3">
                <Button
                  label={a.verification_document_url ? 'Resubmit Document' : 'Upload Document'}
                  onPress={() => pickAndUpload(a.turf_id)}
                  loading={uploading}
                  testID={`upload-document-${a.assignment_id}`}
                />
              </View>
            )}
          </View>
        ))
      )}
    </ScreenContainer>
  );
}
