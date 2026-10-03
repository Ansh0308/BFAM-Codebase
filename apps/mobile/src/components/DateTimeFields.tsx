import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WheelColumn } from './DateOfBirthField';

// Date and time pickers for booking forms: pick from wheels instead of typing
// "2026-10-01" / "18:00" by hand. Same in-page wheel panel as the Date of Birth
// field (no native module, so it behaves the same on phones and on the web).
// Values stay machine-friendly ('YYYY-MM-DD', 'HH:MM'); what the person sees is
// shown as MM-DD-YYYY and a 12-hour time, as asked in tester feedback.

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTHS = MONTH_NAMES.map((name, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: name,
}));

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function daysIn(month: string | null, year: string | null): number {
  if (!month) return 31;
  return new Date(year ? Number(year) : 2000, Number(month), 0).getDate();
}

export function formatDateForDisplay(value: string): string {
  const [y, m, d] = value.split('-');
  return y && m && d ? `${d}-${m}-${y}` : value;
}

export function formatTimeForDisplay(value: string): string {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

function Trigger({
  label,
  icon,
  text,
  placeholder,
  open,
  onPress,
  testID,
}: {
  label: string;
  icon: 'calendar' | 'clock';
  text: string | null;
  placeholder: string;
  open: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <>
      <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        testID={testID ? `${testID}-trigger` : undefined}
        accessibilityRole="button"
        className="flex-row items-center justify-between bg-surface rounded-md border border-border-strong px-4"
        style={{ height: 48 }}
      >
        <View className="flex-row items-center">
          <Feather name={icon} size={16} color="#D80000" />
          <Text
            className={
              text
                ? 'font-ui text-body text-text-primary ml-3'
                : 'font-ui text-body text-text-tertiary ml-3'
            }
          >
            {text ?? placeholder}
          </Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#767676" />
      </Pressable>
    </>
  );
}

function Panel({
  title,
  columnLabels,
  children,
  canConfirm,
  onConfirm,
  onClose,
  testID,
}: {
  title: string;
  // Names above the wheels ("Day", "Month", "Year"), in the order the wheels appear.
  columnLabels?: string[];
  children: React.ReactNode;
  canConfirm: boolean;
  onConfirm: () => void;
  onClose: () => void;
  testID?: string;
}) {
  return (
    <View
      className="bg-surface rounded-lg border border-border-strong overflow-hidden mt-2"
      testID={testID ? `${testID}-panel` : undefined}
    >
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-alt">
        <Text className="font-ui font-bold text-card-title uppercase text-ink-black">{title}</Text>
        <Pressable onPress={onClose} hitSlop={8} testID={testID ? `${testID}-close` : undefined}>
          <Feather name="x" size={18} color="#767676" />
        </Pressable>
      </View>
      {columnLabels ? (
        <View
          className="flex-row border-b border-border-subtle"
          testID={testID ? `${testID}-column-labels` : undefined}
        >
          {columnLabels.map((name, i) => (
            <React.Fragment key={name}>
              {i > 0 ? <View className="w-px bg-border-subtle" /> : null}
              <Text className="flex-1 text-center font-ui font-bold text-micro uppercase tracking-wide text-text-secondary py-2">
                {name}
              </Text>
            </React.Fragment>
          ))}
        </View>
      ) : null}
      <View className="flex-row" style={{ height: 200 }}>
        {children}
      </View>
      <View className="p-3 border-t border-border-subtle">
        <Pressable
          onPress={onConfirm}
          disabled={!canConfirm}
          testID={testID ? `${testID}-done` : undefined}
          className={
            canConfirm
              ? 'bg-brand-red rounded-md py-3 items-center'
              : 'bg-surface-alt rounded-md py-3 items-center'
          }
        >
          <Text
            className={
              canConfirm
                ? 'font-ui text-button uppercase tracking-wide text-white'
                : 'font-ui text-button uppercase tracking-wide text-text-tertiary'
            }
          >
            Done
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

interface DateFieldProps {
  label: string;
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  // Earliest date that can be chosen ('YYYY-MM-DD'), e.g. today for a booking.
  minDate?: string;
  // The text on the closed field when a date is already chosen (default MM-DD-YYYY).
  formatValue?: (value: string) => string;
  testID?: string;
}

// Offers today and the next two years (bookings are never in the past).
export function DateField({
  label,
  value,
  onChange,
  minDate,
  formatValue = formatDateForDisplay,
  testID,
}: DateFieldProps) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const [open, setOpen] = useState(false);
  const parsed = value.split('-');
  const [year, setYear] = useState<string | null>(parsed[0] || null);
  const [month, setMonth] = useState<string | null>(parsed[1] || null);
  const [day, setDay] = useState<string | null>(parsed[2] || null);

  const years = [0, 1, 2].map((i) => ({
    value: String(thisYear + i),
    label: String(thisYear + i),
  }));
  const max = daysIn(month, year);
  const days = Array.from({ length: max }, (_, i) => ({ value: pad(i + 1), label: pad(i + 1) }));
  const shownDay = day && Number(day) <= max ? day : null;
  const chosen = shownDay && month && year ? `${year}-${month}-${shownDay}` : null;
  const tooEarly = Boolean(chosen && minDate && chosen < minDate);
  const complete = Boolean(chosen) && !tooEarly;

  return (
    <View className="mb-4" testID={testID}>
      <Trigger
        label={label}
        icon="calendar"
        text={value ? formatValue(value) : null}
        placeholder="Select date (DD-MM-YYYY)"
        open={open}
        onPress={() => setOpen((o) => !o)}
        testID={testID}
      />
      {open ? (
        <Panel
          title={label}
          columnLabels={['Day', 'Month', 'Year']}
          canConfirm={complete}
          onConfirm={() => {
            onChange(`${year}-${month}-${shownDay}`);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          testID={testID}
        >
          <WheelColumn
            options={days}
            value={shownDay}
            onChange={setDay}
            testID={testID ? `${testID}-day` : undefined}
          />
          <View className="w-px bg-border-subtle" />
          <WheelColumn
            options={MONTHS}
            value={month}
            onChange={setMonth}
            testID={testID ? `${testID}-month` : undefined}
          />
          <View className="w-px bg-border-subtle" />
          <WheelColumn
            options={years}
            value={year}
            onChange={setYear}
            testID={testID ? `${testID}-year` : undefined}
          />
        </Panel>
      ) : null}
      {open && tooEarly ? (
        <Text
          className="font-ui text-micro text-brand-red-dark mt-1"
          testID={testID ? `${testID}-too-early` : undefined}
        >
          Pick today or a later date.
        </Text>
      ) : null}
    </View>
  );
}

interface TimeFieldProps {
  label: string;
  value: string; // 'HH:MM' (24h) or ''
  onChange: (value: string) => void;
  testID?: string;
}

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: pad(h),
  label: formatTimeForDisplay(`${pad(h)}:00`).replace(':00', ''),
}));
const MINUTES = ['00', '15', '30', '45'].map((m) => ({ value: m, label: m }));

export function TimeField({ label, value, onChange, testID }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState<string | null>(value ? value.split(':')[0] : null);
  const [minute, setMinute] = useState<string | null>(value ? value.split(':')[1] : null);
  const complete = Boolean(hour && minute);

  return (
    <View className="mb-4" testID={testID}>
      <Trigger
        label={label}
        icon="clock"
        text={value ? formatTimeForDisplay(value) : null}
        placeholder="Select time"
        open={open}
        onPress={() => setOpen((o) => !o)}
        testID={testID}
      />
      {open ? (
        <Panel
          title={label}
          columnLabels={['Hour', 'Minute']}
          canConfirm={complete}
          onConfirm={() => {
            onChange(`${hour}:${minute}`);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          testID={testID}
        >
          <WheelColumn
            options={HOURS}
            value={hour}
            onChange={setHour}
            testID={testID ? `${testID}-hour` : undefined}
          />
          <View className="w-px bg-border-subtle" />
          <WheelColumn
            options={MINUTES}
            value={minute}
            onChange={setMinute}
            testID={testID ? `${testID}-minute` : undefined}
          />
        </Panel>
      ) : null}
    </View>
  );
}
