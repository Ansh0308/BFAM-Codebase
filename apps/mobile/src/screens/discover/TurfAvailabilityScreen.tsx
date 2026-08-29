import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AvailabilitySlot, TurfAvailability } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../lib/apiClient';
import { colors } from '../../theme/tokens';
import { SlotRow } from '../../components/SlotRow';
import type { DiscoverStackParamList } from '../../navigation/types';

type Props = StackScreenProps<DiscoverStackParamList, 'TurfAvailability'>;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextSevenDays(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return toDateStr(d);
  });
}

const PAYMENT_MODES = ['UPI', 'GATEWAY', 'CASH', 'CAPTAIN_PAYS', 'SPLIT_PAYMENT'] as const;

// Turf Availability: calendar/slot grid, visually distinguishing available
// vs. booked slots (Design §1.2/§1.3 — booked = disabled gray surface,
// available = brand-red text/dot, never green).
export function TurfAvailabilityScreen({ route, navigation }: Props) {
  const { turfId, turfName, date: initialDate } = route.params;
  const dates = useMemo(() => nextSevenDays(), []);
  const [selectedDate, setSelectedDate] = useState(initialDate ?? dates[0]);
  const [availability, setAvailability] = useState<TurfAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<AvailabilitySlot | null>(null);
  const [paymentMode, setPaymentMode] = useState<(typeof PAYMENT_MODES)[number]>('UPI');
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

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

  const openSlot = (slot: AvailabilitySlot) => {
    setBookingError(null);
    setPaymentMode('UPI');
    setPendingSlot(slot);
  };

  const durationMinutes = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  };

  const confirmBooking = async () => {
    if (!pendingSlot) return;
    setBooking(true);
    setBookingError(null);
    try {
      const created = await apiClient.createBooking({
        turf_id: turfId,
        booking_date: selectedDate,
        start_time: pendingSlot.start_time,
        duration_minutes: durationMinutes(pendingSlot.start_time, pendingSlot.end_time),
        payment_mode: paymentMode,
      });
      setPendingSlot(null);
      navigation.replace('BookingConfirmation', { bookingId: created.booking_id });
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
    <View className="flex-1 bg-surface-alt">
      <View className="px-6 pt-6 pb-2">
        <Text className="font-display text-title-xl text-ink-black uppercase" numberOfLines={1}>
          {turfName}
        </Text>
        <Text className="text-text-secondary text-body mt-1">Select a slot to book</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 py-3">
        {dates.map((d) => {
          const isSelected = d === selectedDate;
          return (
            <Pressable
              key={d}
              onPress={() => setSelectedDate(d)}
              className={`rounded-md px-4 py-2 mr-2 border ${
                isSelected ? 'bg-brand-red border-brand-red' : 'bg-surface border-border-strong'
              }`}
              testID={`date-chip-${d}`}
            >
              <Text
                className={`text-body font-ui ${isSelected ? 'text-surface' : 'text-text-primary'}`}
              >
                {new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="flex-1 px-6">
        {loading && (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color={colors.brandRed} testID="availability-loading" />
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
                <Text className="font-display text-section-header text-ink-black uppercase">
                  Confirm Slot
                </Text>
                <Text className="text-text-secondary text-body mt-1">
                  {selectedDate} · {pendingSlot.start_time.slice(0, 5)}–
                  {pendingSlot.end_time.slice(0, 5)}
                </Text>
                {pendingSlot.price_per_hour !== null && (
                  <Text className="text-text-primary text-button mt-2">
                    ₹{pendingSlot.price_per_hour}/hr
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
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text className="font-ui font-bold text-surface text-button uppercase">
                      Confirm Booking
                    </Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setPendingSlot(null)} className="items-center mt-3">
                  <Text className="text-text-secondary text-body">Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
