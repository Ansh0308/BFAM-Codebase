import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StaffAssignment, Turf } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { ChipSelect } from '../src/components/ChipSelect';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

const STATUS_COLOR: Record<string, string> = {
  APPROVED: 'text-brand-red',
  PENDING: 'text-text-secondary',
  REJECTED: 'text-text-tertiary',
};

// Staff Management (module 2.12, PRD §8.3/§9.2), incl. Staff Verification
// review (PRD §32.14) — an owner assigns a staff account per turf, then
// approves/rejects the document that account submits.
export default function OwnerStaffScreen() {
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [turfId, setTurfId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStaffUserId, setNewStaffUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient
      .getMyTurfs()
      .then((res) => {
        setTurfs(res.results);
        if (res.results.length > 0) setTurfId(res.results[0].turf_id);
      })
      .catch(() => setTurfs([]));
  }, []);

  const loadStaff = useCallback(() => {
    if (!turfId) return;
    setLoading(true);
    apiClient
      .listStaffForTurf(turfId)
      .then((res) => setStaff(res.results))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, [turfId]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  async function assign() {
    if (!turfId || !newStaffUserId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.assignStaff(turfId, newStaffUserId.trim());
      setNewStaffUserId('');
      loadStaff();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not assign staff.');
    } finally {
      setBusy(false);
    }
  }

  async function review(assignmentId: string, decision: 'APPROVED' | 'REJECTED') {
    setBusy(true);
    setError(null);
    try {
      await apiClient.reviewStaffVerification(assignmentId, decision);
      loadStaff();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not review this staff member.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(assignmentId: string) {
    setBusy(true);
    try {
      await apiClient.removeStaff(assignmentId);
      loadStaff();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView className="px-5 flex-1" testID="owner-staff-screen">
        <ScreenHeader title="Staff Management" />

        {turfs.length > 0 && (
          <ChipSelect
            label="Turf"
            options={turfs.map((t) => ({ value: t.turf_id, label: t.turf_name }))}
            value={turfId}
            onChange={setTurfId}
            testID="staff-turf-select"
          />
        )}

        <TextField
          label="Staff User ID"
          value={newStaffUserId}
          onChangeText={setNewStaffUserId}
          placeholder="Registered TURF_STAFF user ID"
          testID="new-staff-user-id-input"
        />
        {error && <Text className="text-brand-red text-body mb-3">{error}</Text>}
        <Button label="Assign Staff" onPress={assign} loading={busy} testID="assign-staff-button" />

        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-6 mb-2">
          Staff ({staff.length})
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.brandRed}
            style={{ marginTop: 12 }}
            testID="owner-staff-loading"
          />
        ) : staff.length === 0 ? (
          <Text className="font-ui text-body text-text-tertiary" testID="owner-staff-empty">
            No staff assigned to this turf yet.
          </Text>
        ) : (
          staff.map((s) => (
            <View
              key={s.assignment_id}
              className="bg-surface-alt rounded-lg p-4 mb-3"
              testID={`staff-row-${s.assignment_id}`}
            >
              <Text className="font-ui font-bold text-body text-text-primary">
                {s.phone_number ?? s.staff_user_id}
              </Text>
              <Text
                className={`font-ui text-micro uppercase mt-1 ${STATUS_COLOR[s.verification_status]}`}
              >
                {s.verification_status}
              </Text>
              {s.verification_status === 'PENDING' && s.verification_document_url && (
                <View className="flex-row mt-3">
                  <View className="mr-2">
                    <Button
                      label="Approve"
                      onPress={() => review(s.assignment_id, 'APPROVED')}
                      loading={busy}
                      testID={`approve-${s.assignment_id}`}
                    />
                  </View>
                  <Button
                    label="Reject"
                    variant="secondary"
                    onPress={() => review(s.assignment_id, 'REJECTED')}
                    loading={busy}
                    testID={`reject-${s.assignment_id}`}
                  />
                </View>
              )}
              {s.verification_status === 'PENDING' && !s.verification_document_url && (
                <Text className="font-ui text-micro text-text-tertiary mt-2">
                  Waiting for the staff member to submit their document.
                </Text>
              )}
              <View className="mt-3">
                <Button
                  label="Remove"
                  variant="ghost"
                  onPress={() => remove(s.assignment_id)}
                  testID={`remove-staff-${s.assignment_id}`}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
