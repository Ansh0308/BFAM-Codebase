import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { BallLoader } from '../../../../../src/components/BallLoader';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { AvailabilitySlot, TurfAvailability } from '@bfam/shared-types';
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

const PAYMENT_MODES = ['UPI', 'GATEWAY', 'CASH', 'CAPTAIN_PAYS', 'SPLIT_PAYMENT'] as const;

// Turf Availability: calendar/slot grid, visually distinguishing available
// vs. booked slots (Design §1.2/§1.3 — booked = disabled gray surface,
// available = brand-red text/dot, never green).
export default function TurfAvailabilityScreen() {
  const { turfId, turfName } = useLocalSearchParams<{ turfId: string; turfName?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [availability, setAvailability] = useState<TurfAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<AvailabilitySlot | null>(null);
  // Index of pendingSlot within availability.slots — needed to look up the
  // following slots when the player extends the booking past one hour
  // (Feedback A-1: "let them book multiple slots, e.g. a 3-hour block, at
  // once" — the backend already accepts any duration_minutes from 30 to
  // 480, this was purely a missing mobile UI).
  const [pendingIndex, setPendingIndex] = useState<number>(-1);
  const [durationHours, setDurationHours] = useState(1);
  const [paymentMode, setPaymentMode] = useState<(typeof PAYMENT_MODES)[number]>('UPI');
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    if (turfName) navigation.setOptions({ title: turfName });
  }, [navigation, turfName]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getTurfAvailability(turfId, selectedDate);
      setAvailability(data);
    } catch {
      setError('Could not load availability for this date.');
    } finally {
      setLoading(false);
    }
  }, [turfId, selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  // How many consecutive hours starting at `startIndex` are bookable in one
  // go — stops at the first non-AVAILABLE slot (booked/blocked) or any gap
  // in the hour-to-hour chain, so a player can never select across a hole.
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
    setBookingError(null);
    setPaymentMode('UPI');
    setPendingSlot(slot);
    setPendingIndex(index);
    setDurationHours(1);
  };

  const maxDurationHours =
    availability && pendingIndex >= 0
      ? Math.min(8, maxAvailableRunFrom(availability.slots, pendingIndex))
      : 1;
  // Clamped rather than trusted directly — a reload after a 409 conflict
  // (someone else took a later hour in the range) can shrink
  // maxDurationHours out from under a duration the player already chose.
  const effectiveDurationHours = Math.min(durationHours, Math.max(1, maxDurationHours));

  // The slots this booking actually spans, given the chosen duration —
  // used for both the total price (summed per-hour, so a rate change
  // mid-range is still priced correctly) and the displayed end time.
  const selectedSlots =
    availability && pendingIndex >= 0
      ? availability.slots.slice(pendingIndex, pendingIndex + effectiveDurationHours)
      : [];
  const totalPrice = selectedSlots.reduce((sum, s) => sum + (s.price_per_hour ?? 0), 0);
  const rangeEndTime =
    selectedSlots.length > 0 ? selectedSlots[selectedSlots.length - 1].end_time : null;

  const confirmBooking = async () => {
    if (!pendingSlot) return;
    setBooking(true);
    setBookingError(null);
    try {
      const created = await apiClient.createBooking({
        turf_id: turfId,
        booking_date: selectedDate,
        start_time: pendingSlot.start_time,
        duration_minutes: effectiveDurationHours * 60,
        payment_mode: paymentMode,
      });
      setPendingSlot(null);
      setPendingIndex(-1);
      router.replace(`/(tabs)/discover/booking/${created.booking_id}/confirmation`);
    } catch (err) {
      if (err instanceof BFAMApiError && err.status === 409) {
        // PRD §15: no-double-booking — surface the backend's clean message
        // and refresh the grid so the now-taken slot shows as BOOKED.
        setBookingError(err.message);
        load();
      } else if (err instanceof BFAMApiError) {
        setBookingError(err.message);
      } else {
        setBookingError('Something went wrong while booking. Please try again.');
      }
    } finally {
      setBooking(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-alt" edges={['bottom']}>
      <Pressable
        onPress={() => setShowDatePicker(true)}
        className="flex-row items-center justify-between mx-6 mt-3 px-4 py-3 bg-surface rounded-md border border-border-strong"
        testID="availability-date-picker-trigger"
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

      <View className="flex-1 px-6">
        {loading && (
          <View className="py-10 items-center">
            <BallLoader testID="availability-loading" />
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
                  Confirm Booking
                </Text>
                <Text className="text-text-secondary text-body mt-1" testID="booking-time-range">
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
                      testID="duration-decrease"
                    >
                      <Text className="font-ui font-bold text-title-xl text-text-primary">−</Text>
                    </Pressable>
                    <Text
                      className="font-ui font-bold text-body text-ink-black mx-4"
                      testID="duration-hours-value"
                    >
                      {effectiveDurationHours} hr{effectiveDurationHours === 1 ? '' : 's'}
                    </Text>
                    <Pressable
                      onPress={() => setDurationHours((h) => Math.min(maxDurationHours, h + 1))}
                      disabled={effectiveDurationHours >= maxDurationHours}
                      className="w-9 h-9 rounded-full bg-surface-alt items-center justify-center"
                      testID="duration-increase"
                    >
                      <Text className="font-ui font-bold text-title-xl text-text-primary">+</Text>
                    </Pressable>
                  </View>
                </View>
                {maxDurationHours < 8 && (
                  <Text className="text-micro text-text-tertiary mt-1">
                    Up to {maxDurationHours} contiguous hour{maxDurationHours === 1 ? '' : 's'}{' '}
                    available from this slot.
                  </Text>
                )}

                {totalPrice > 0 && (
                  <Text className="text-text-primary text-button mt-3" testID="booking-total-price">
                    ₹{totalPrice} total
                  </Text>
                )}

                <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-4 mb-2">
                  Payment Mode
                </Text>
                <View className="flex-row flex-wrap">
                  {PAYMENT_MODES.map((mode) => {
                    const selected = mode === paymentMode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => setPaymentMode(mode)}
                        className={`rounded-sm px-3 py-2 mr-2 mb-2 border ${
                          selected
                            ? 'bg-brand-red border-brand-red'
                            : 'bg-surface border-border-strong'
                        }`}
                        testID={`payment-mode-${mode}`}
                      >
                        <Text
                          className={`text-micro ${selected ? 'text-surface' : 'text-text-primary'}`}
                        >
                          {mode.replace('_', ' ')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {bookingError && (
                  <Text className="text-brand-red text-body mt-3" testID="booking-error-message">
                    {bookingError}
                  </Text>
                )}

                <Pressable
                  onPress={confirmBooking}
                  disabled={booking}
                  className="bg-brand-red rounded-md py-4 items-center mt-4"
                  testID="confirm-booking-button"
                >
                  {booking ? (
                    <BallLoader size="button" tone="light" />
                  ) : (
                    <Text className="font-ui font-bold text-surface text-button uppercase">
                      Confirm Booking
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPendingSlot(null);
                    setPendingIndex(-1);
                  }}
                  className="items-center mt-3"
                  testID="cancel-booking-button"
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
