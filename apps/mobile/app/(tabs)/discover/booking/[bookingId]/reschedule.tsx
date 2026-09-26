import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { BallLoader } from '../../../../../src/components/BallLoader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { AvailabilitySlot, Booking, TurfAvailability } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../../src/lib/apiClient';
import { colors } from '../../../../../src/theme/tokens';
import { SlotRow } from '../../../../../src/components/SlotRow';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return toDateStr(new Date());
}

function formatDisplayDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

// Reschedule Booking (backlog G-23) — its own flow, not a manual cancel +
// rebook. Deliberately reuses the same slot-grid picker as Turf Availability
// (booking a fresh slot) rather than a free-form date/time input, since
// that's the app's one established way to pick a booking slot; the only
// difference is the confirm action calls rescheduleBooking instead of
// createBooking, and there's no payment-mode picker (it carries over from
// the original booking — see bookingService.ts's rescheduleBooking).
export default function RescheduleBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [availability, setAvailability] = useState<TurfAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<AvailabilitySlot | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number>(-1);
  const [durationHours, setDurationHours] = useState(1);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getBookingDetails(bookingId).then(setBooking);
  }, [bookingId]);

  const load = useCallback(async () => {
    if (!booking) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getTurfAvailability(booking.turf_id, selectedDate);
      setAvailability(data);
    } catch {
      setError('Could not load availability for this date.');
    } finally {
      setLoading(false);
    }
  }, [booking, selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  const maxAvailableRunFrom = (slots: AvailabilitySlot[], startIndex: number): number => {
    let count = 0;
    for (let i = startIndex; i < slots.length; i += 1) {
      if (slots[i].status !== 'AVAILABLE') break;
      if (i > startIndex && slots[i].start_time !== slots[i - 1].end_time) break;
      count += 1;
    }
    return count;
  };

  const openSlot = (slot: AvailabilitySlot) => {
    const index = availability?.slots.findIndex((s) => s.start_time === slot.start_time) ?? -1;
    setRescheduleError(null);
    setPendingSlot(slot);
    setPendingIndex(index);
    setDurationHours(1);
  };

  const maxDurationHours =
    availability && pendingIndex >= 0
      ? Math.min(8, maxAvailableRunFrom(availability.slots, pendingIndex))
      : 1;
  const effectiveDurationHours = Math.min(durationHours, Math.max(1, maxDurationHours));

  const selectedSlots =
    availability && pendingIndex >= 0
      ? availability.slots.slice(pendingIndex, pendingIndex + effectiveDurationHours)
      : [];
  const totalPrice = selectedSlots.reduce((sum, s) => sum + (s.price_per_hour ?? 0), 0);
  const rangeEndTime =
    selectedSlots.length > 0 ? selectedSlots[selectedSlots.length - 1].end_time : null;

  const confirmReschedule = async () => {
    if (!pendingSlot) return;
    setRescheduling(true);
    setRescheduleError(null);
    try {
      await apiClient.rescheduleBooking(bookingId, {
        booking_date: selectedDate,
        start_time: pendingSlot.start_time,
        duration_minutes: effectiveDurationHours * 60,
      });
      setPendingSlot(null);
      setPendingIndex(-1);
      router.replace(`/(tabs)/discover/booking/${bookingId}`);
    } catch (err) {
      if (err instanceof BFAMApiError) {
        setRescheduleError(err.message);
        if (err.status === 409) load();
      } else {
        setRescheduleError('Something went wrong while rescheduling. Please try again.');
      }
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-alt" edges={['bottom']}>
      <View className="px-6 pt-4">
        <Text className="font-ui font-bold text-title-xl text-ink-black">Reschedule Booking</Text>
        <Text className="text-text-secondary text-body mt-1">
          Pick a new slot — your current booking is cancelled once this one is confirmed.
        </Text>
      </View>

      <Pressable
        onPress={() => setShowDatePicker(true)}
        className="flex-row items-center justify-between mx-6 mt-4 px-4 py-3 bg-surface rounded-md border border-border-strong"
        testID="reschedule-date-picker-trigger"
      >
        <View className="flex-row items-center">
          <Feather name="calendar" size={18} color={colors.brandRed} />
          <Text className="font-ui font-semibold text-body text-ink-black ml-3">
            {selectedDate === todayStr() ? 'Today' : formatDisplayDate(selectedDate)}
          </Text>
        </View>
        <Feather name="chevron-down" size={18} color={colors.textTertiary} />
      </Pressable>
      {showDatePicker && (
        <DateTimePicker
          value={new Date(`${selectedDate}T00:00:00`)}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (event.type === 'dismissed' || !date) return;
            setSelectedDate(toDateStr(date));
          }}
        />
      )}

      <View className="flex-1 px-6 mt-4">
        {loading && (
          <View className="py-10 items-center">
            <BallLoader testID="reschedule-availability-loading" />
          </View>
        )}

        {!loading && error && (
          <Text className="text-text-secondary text-body text-center mt-6">{error}</Text>
        )}

        {!loading && !error && availability && availability.slots.length === 0 && (
          <Text className="text-text-secondary text-body text-center mt-6">
            This turf is closed on this date.
          </Text>
        )}

        {!loading && !error && availability && availability.slots.length > 0 && (
          <FlatList
            data={availability.slots}
            keyExtractor={(item) => item.start_time}
            renderItem={({ item }) => <SlotRow slot={item} onPress={openSlot} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal visible={pendingSlot !== null} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-surface rounded-t-lg px-6 pt-5 pb-8">
            {pendingSlot && (
              <>
                <Text className="font-ui font-bold text-section-header text-ink-black uppercase tracking-wide">
                  Confirm New Slot
                </Text>
                <Text className="text-text-secondary text-body mt-1" testID="reschedule-time-range">
                  {selectedDate} · {pendingSlot.start_time.slice(0, 5)}–
                  {(rangeEndTime ?? pendingSlot.end_time).slice(0, 5)}
                </Text>

                <View className="flex-row items-center justify-between mt-4">
                  <Text className="font-ui font-bold text-text-secondary text-micro uppercase">
                    Duration
                  </Text>
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() => setDurationHours((h) => Math.max(1, h - 1))}
                      disabled={effectiveDurationHours <= 1}
                      className="w-9 h-9 rounded-full bg-surface-alt items-center justify-center"
                      testID="reschedule-duration-decrease"
                    >
                      <Text className="font-ui font-bold text-title-xl text-text-primary">−</Text>
                    </Pressable>
                    <Text
                      className="font-ui font-bold text-body text-ink-black mx-4"
                      testID="reschedule-duration-hours-value"
                    >
                      {effectiveDurationHours} hr{effectiveDurationHours === 1 ? '' : 's'}
                    </Text>
                    <Pressable
                      onPress={() => setDurationHours((h) => Math.min(maxDurationHours, h + 1))}
                      disabled={effectiveDurationHours >= maxDurationHours}
                      className="w-9 h-9 rounded-full bg-surface-alt items-center justify-center"
                      testID="reschedule-duration-increase"
                    >
                      <Text className="font-ui font-bold text-title-xl text-text-primary">+</Text>
                    </Pressable>
                  </View>
                </View>

                {totalPrice > 0 && (
                  <Text
                    className="text-text-primary text-button mt-3"
                    testID="reschedule-total-price"
                  >
                    ₹{totalPrice} total
                  </Text>
                )}

                {rescheduleError && (
                  <Text className="text-brand-red text-body mt-3" testID="reschedule-error-message">
                    {rescheduleError}
                  </Text>
                )}

                <Pressable
                  onPress={confirmReschedule}
                  disabled={rescheduling}
                  className="bg-brand-red rounded-md py-4 items-center mt-4"
                  testID="confirm-reschedule-button"
                >
                  {rescheduling ? (
                    <BallLoader size="button" tone="light" />
                  ) : (
                    <Text className="font-ui font-bold text-surface text-button uppercase">
                      Confirm Reschedule
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPendingSlot(null);
                    setPendingIndex(-1);
                  }}
                  className="items-center mt-3"
                  testID="cancel-reschedule-slot-button"
                >
                  <Text className="text-text-secondary text-body">Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
