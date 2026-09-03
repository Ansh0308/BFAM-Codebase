import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type {
  SetPricingRow,
  Turf,
  TurfAvailabilityBlock,
  TurfPricingRule,
} from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { ChipSelect } from '../../src/components/ChipSelect';
import { ToggleRow } from '../../src/components/ToggleRow';
import { Button } from '../../src/components/Button';
import { colors } from '../../src/theme/tokens';
import { apiClient } from '../../src/lib/apiClient';

const DAY_TYPES: { value: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY'; label: string }[] = [
  { value: 'WEEKDAY', label: 'Weekday' },
  { value: 'WEEKEND', label: 'Weekend' },
  { value: 'HOLIDAY', label: 'Holiday' },
];
const BLOCK_REASONS: {
  value: 'MAINTENANCE' | 'HOLIDAY' | 'OWNER_BLOCK' | 'SYSTEM_BLOCK';
  label: string;
}[] = [
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'OWNER_BLOCK', label: 'Owner Block' },
  { value: 'SYSTEM_BLOCK', label: 'System Block' },
];

// Turf Management + Pricing + Availability + Sound Settings (module 2.12,
// PRD §8.3/§9.2), combined into one management hub per turf rather than
// four separate screens — everything an owner does for a single turf in
// one place.
export default function ManageTurfScreen() {
  const { turfId } = useLocalSearchParams<{ turfId: string }>();

  const [turf, setTurf] = useState<Turf | null>(null);
  const [loading, setLoading] = useState(true);
  const [turfName, setTurfName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [savingTurf, setSavingTurf] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [savingSound, setSavingSound] = useState(false);

  const [pricing, setPricing] = useState<TurfPricingRule[]>([]);
  const [dayType, setDayType] = useState<'WEEKDAY' | 'WEEKEND' | 'HOLIDAY'>('WEEKDAY');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('22:00');
  const [pricePerHour, setPricePerHour] = useState('');
  const [savingPricing, setSavingPricing] = useState(false);

  const [blocks, setBlocks] = useState<TurfAvailabilityBlock[]>([]);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState<
    'MAINTENANCE' | 'HOLIDAY' | 'OWNER_BLOCK' | 'SYSTEM_BLOCK'
  >('MAINTENANCE');
  const [savingBlock, setSavingBlock] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.getOwnerTurf(turfId),
      apiClient.listAvailabilityBlocks(turfId),
      apiClient.getTurfPricing(turfId),
    ])
      .then(([t, blockRes, pricingRes]) => {
        setTurf(t);
        setTurfName(t.turf_name);
        setAddressLine(t.address_line);
        setCity(t.city);
        setSoundEnabled(t.stadium_sound_enabled);
        setPricing(pricingRes.results);
        setBlocks(blockRes.results);
      })
      .catch(() => setError('Could not load this turf.'))
      .finally(() => setLoading(false));
  }, [turfId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTurf() {
    setSavingTurf(true);
    setError(null);
    try {
      const t = await apiClient.updateTurf(turfId, {
        turf_name: turfName,
        address_line: addressLine,
        city,
      });
      setTurf(t);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save turf details.');
    } finally {
      setSavingTurf(false);
    }
  }

  async function toggleSound(value: boolean) {
    setSoundEnabled(value);
    setSavingSound(true);
    try {
      await apiClient.setStadiumSound(turfId, value);
    } catch {
      setSoundEnabled(!value);
    } finally {
      setSavingSound(false);
    }
  }

  async function addPricingRow() {
    const price = Number(pricePerHour);
    if (Number.isNaN(price) || price <= 0) {
      setError('Enter a valid price per hour.');
      return;
    }
    setSavingPricing(true);
    setError(null);
    try {
      const rows: SetPricingRow[] = [
        ...pricing.map((p) => ({
          day_type: p.day_type,
          start_time: p.start_time,
          end_time: p.end_time,
          price_per_hour: Number(p.price_per_hour),
        })),
        { day_type: dayType, start_time: startTime, end_time: endTime, price_per_hour: price },
      ];
      const res = await apiClient.setTurfPricing(turfId, rows);
      setPricing(res.results);
      setPricePerHour('');
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save pricing.');
    } finally {
      setSavingPricing(false);
    }
  }

  async function addBlock() {
    if (!blockStart.trim() || !blockEnd.trim()) {
      setError('Enter a start and end date/time for the block.');
      return;
    }
    setSavingBlock(true);
    setError(null);
    try {
      await apiClient.createAvailabilityBlock(turfId, {
        start_datetime: blockStart.trim(),
        end_datetime: blockEnd.trim(),
        reason: blockReason,
      });
      setBlockStart('');
      setBlockEnd('');
      const res = await apiClient.listAvailabilityBlocks(turfId);
      setBlocks(res.results);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the block.');
    } finally {
      setSavingBlock(false);
    }
  }

  async function removeBlock(blockId: string) {
    await apiClient.removeAvailabilityBlock(blockId);
    setBlocks((prev) => prev.filter((b) => b.block_id !== blockId));
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="manage-turf-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (!turf) {
    return (
      <ScreenContainer>
        <Text
          className="font-ui text-body text-text-secondary text-center mt-8"
          testID="manage-turf-error"
        >
          Could not load this turf.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title={turf.turf_name} />
      {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2 mt-2">
        Turf Details
      </Text>
      <TextField
        label="Turf Name"
        value={turfName}
        onChangeText={setTurfName}
        testID="edit-turf-name"
      />
      <TextField
        label="Address"
        value={addressLine}
        onChangeText={setAddressLine}
        testID="edit-turf-address"
      />
      <TextField label="City" value={city} onChangeText={setCity} testID="edit-turf-city" />
      <Button
        label="Save Details"
        onPress={saveTurf}
        loading={savingTurf}
        testID="save-turf-details"
      />

      <View className="mt-6">
        <ToggleRow
          label="Stadium Sound"
          description="Enable/disable the stadium audio system for this turf"
          value={soundEnabled}
          onValueChange={toggleSound}
          disabled={savingSound}
          testID="toggle-stadium-sound"
        />
      </View>

      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2 mt-6">
        Pricing
      </Text>
      {pricing.map((p, i) => (
        <View key={i} className="bg-surface-alt rounded-md p-3 mb-2" testID={`pricing-row-${i}`}>
          <Text className="font-ui text-body text-text-primary">
            {p.day_type} · {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)} · ₹{p.price_per_hour}
            /hr
          </Text>
        </View>
      ))}
      <ChipSelect
        label="Day Type"
        options={DAY_TYPES}
        value={dayType}
        onChange={(v) => setDayType(v as typeof dayType)}
        testID="pricing-day-type"
      />
      <TextField
        label="Start Time (HH:MM)"
        value={startTime}
        onChangeText={setStartTime}
        testID="pricing-start-time"
      />
      <TextField
        label="End Time (HH:MM)"
        value={endTime}
        onChangeText={setEndTime}
        testID="pricing-end-time"
      />
      <TextField
        label="Price per Hour"
        value={pricePerHour}
        onChangeText={setPricePerHour}
        keyboardType="numeric"
        testID="pricing-price"
      />
      <Button
        label="Add Pricing Row"
        variant="secondary"
        onPress={addPricingRow}
        loading={savingPricing}
        testID="add-pricing-row"
      />

      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2 mt-6">
        Availability Blocks
      </Text>
      {blocks.map((b) => (
        <View
          key={b.block_id}
          className="flex-row items-center justify-between bg-surface-alt rounded-md p-3 mb-2"
          testID={`block-row-${b.block_id}`}
        >
          <Text className="font-ui text-body text-text-primary flex-1">
            {b.reason} · {new Date(b.start_datetime).toLocaleString()} –{' '}
            {new Date(b.end_datetime).toLocaleString()}
          </Text>
          <Button
            label="Remove"
            variant="ghost"
            onPress={() => removeBlock(b.block_id)}
            testID={`remove-block-${b.block_id}`}
          />
        </View>
      ))}
      <TextField
        label="Block Start (ISO datetime)"
        value={blockStart}
        onChangeText={setBlockStart}
        placeholder="2026-01-01T09:00:00"
        testID="block-start-input"
      />
      <TextField
        label="Block End (ISO datetime)"
        value={blockEnd}
        onChangeText={setBlockEnd}
        placeholder="2026-01-01T18:00:00"
        testID="block-end-input"
      />
      <ChipSelect
        label="Reason"
        options={BLOCK_REASONS}
        value={blockReason}
        onChange={(v) => setBlockReason(v as typeof blockReason)}
        testID="block-reason"
      />
      <Button
        label="Add Block"
        variant="secondary"
        onPress={addBlock}
        loading={savingBlock}
        testID="add-block"
      />

      <View className="mb-10" />
    </ScreenContainer>
  );
}
