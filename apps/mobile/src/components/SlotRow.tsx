import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AvailabilitySlot } from '@bfam/shared-types';

interface Props {
  slot: AvailabilitySlot;
  onPress: (slot: AvailabilitySlot) => void;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = Number(h);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${period}`;
}

// Single-column availability slot list (Design §3.3). Design §1.2/§1.3:
// booked/blocked slots render as a disabled gray surface, available slots
// use brand-red text/dot — never green.
export function SlotRow({ slot, onPress }: Props) {
  const isAvailable = slot.status === 'AVAILABLE';

  return (
    <Pressable
      disabled={!isAvailable}
      onPress={() => onPress(slot)}
      className={`flex-row items-center justify-between px-4 py-4 mb-2 rounded-md border ${
        isAvailable ? 'bg-surface border-border-subtle' : 'bg-disabled-surface border-border-subtle'
      }`}
      testID={`slot-${slot.start_time}`}
    >
      <View className="flex-row items-center">
        <View
          className={`w-2 h-2 rounded-full mr-3 ${isAvailable ? 'bg-brand-red' : 'bg-text-tertiary'}`}
        />
        <Text
          className={`font-ui text-button ${isAvailable ? 'text-text-primary' : 'text-text-tertiary'}`}
        >
          {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
        </Text>
      </View>
      <View className="flex-row items-center">
        {slot.price_per_hour !== null && (
          <Text
            className={`text-body mr-3 ${isAvailable ? 'text-text-secondary' : 'text-text-tertiary'}`}
          >
            ₹{slot.price_per_hour}/hr
          </Text>
        )}
        <Text
          className={`text-micro uppercase ${isAvailable ? 'text-brand-red' : 'text-text-tertiary'}`}
        >
          {isAvailable ? 'Available' : slot.status === 'BLOCKED' ? 'Blocked' : 'Booked'}
        </Text>
      </View>
    </Pressable>
  );
}
