import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface DateOfBirthFieldProps {
  value: string | null; // 'YYYY-MM-DD' or null
  onChange: (value: string | null) => void;
  testID?: string;
}

const MONTHS = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];
const MONTH_FULL_NAMES: Record<string, string> = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};

function daysInMonth(month: string | null, year: string | null): number {
  if (!month) return 31;
  const y = year ? Number(year) : 2000; // a leap year default so Feb 29 stays selectable pre-year-pick
  return new Date(y, Number(month), 0).getDate();
}

const CURRENT_YEAR = new Date().getFullYear();
// A player has to be at least 5 to plausibly be signing up, and the range
// stops at a sane upper bound rather than allowing implausible birth years.
const YEARS = Array.from({ length: 80 }, (_, i) => String(CURRENT_YEAR - 5 - i)).map((y) => ({
  value: y,
  label: y,
}));

function parse(value: string | null): {
  day: string | null;
  month: string | null;
  year: string | null;
} {
  if (!value) return { day: null, month: null, year: null };
  const [year, month, day] = value.split('-');
  return { day, month, year };
}

// Required Date of Birth field (product decision, 2026-08-30 — collected
// for future analytics, not age-gating). A single premium trigger showing
// the formatted date opens an in-flow card with three scrollable wheel
// columns (day/month/year) — deliberately not RN's `Modal` (its web portal
// doesn't reliably composite on top of the page — see git history) and not
// three separate boxy dropdowns (looked cheap/disjointed) — this reads as
// one cohesive premium control, matching TextField/ChipSelect's polish.
//
// Day/month/year are held as local state rather than fully re-derived from
// `value` on every render — `value` only becomes non-null once all three
// are picked, so re-deriving from it would erase a partial selection on
// the very next render. Local state is only resynced from `value` when it
// changes to a *different* complete date (e.g. loaded from the server).
export function DateOfBirthField({ value, onChange, testID }: DateOfBirthFieldProps) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string | null>(() => parse(value).day);
  const [month, setMonth] = useState<string | null>(() => parse(value).month);
  const [year, setYear] = useState<string | null>(() => parse(value).year);

  useEffect(() => {
    const parsed = parse(value);
    const current = day && month && year ? `${year}-${month}-${day}` : null;
    if (value !== current) {
      setDay(parsed.day);
      setMonth(parsed.month);
      setYear(parsed.year);
    }
    // Only resync when the externally-provided value changes — not on
    // every local day/month/year edit (that would fight the local state).
  }, [value]);

  const maxDay = daysInMonth(month, year);
  const days = Array.from({ length: maxDay }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return { value: d, label: d };
  });
  const displayDay = day && Number(day) <= maxDay ? day : null;

  function handleDone() {
    if (displayDay && month && year) {
      onChange(`${year}-${month}-${displayDay}`);
      setOpen(false);
    }
  }

  const displayText =
    value && displayDay && month && year
      ? `${displayDay} ${MONTH_FULL_NAMES[month]} ${year}`
      : null;

  return (
    <View className="mb-4" style={{ position: 'relative', zIndex: open ? 50 : 1 }} testID={testID}>
      <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
        Date of Birth
      </Text>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        testID={testID ? `${testID}-trigger` : undefined}
        accessibilityRole="button"
        className="flex-row items-center justify-between bg-surface rounded-md border border-border-strong px-4"
        style={{ height: 48 }}
      >
        <View className="flex-row items-center">
          <Feather name="calendar" size={16} color="#D80000" />
          <Text
            className={
              displayText
                ? 'font-ui text-body text-text-primary ml-3'
                : 'font-ui text-body text-text-tertiary ml-3'
            }
          >
            {displayText ?? 'Select date of birth'}
          </Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#767676" />
      </Pressable>

      {open ? (
        <View
          className="bg-surface rounded-lg border border-border-strong overflow-hidden"
          style={{
            position: 'absolute',
            top: 78,
            left: 0,
            right: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 16,
            elevation: 8,
          }}
          testID={testID ? `${testID}-panel` : undefined}
        >
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-alt">
            <Text className="font-display text-card-title uppercase text-ink-black">
              Date of Birth
            </Text>
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={8}
              testID={testID ? `${testID}-close` : undefined}
            >
              <Feather name="x" size={18} color="#767676" />
            </Pressable>
          </View>

          <View className="flex-row" style={{ height: 200 }}>
            <WheelColumn
              options={days}
              value={displayDay}
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
              options={YEARS}
              value={year}
              onChange={setYear}
              testID={testID ? `${testID}-year` : undefined}
            />
          </View>

          <View className="p-3 border-t border-border-subtle">
            <Pressable
              onPress={handleDone}
              disabled={!(displayDay && month && year)}
              testID={testID ? `${testID}-done` : undefined}
              className={
                displayDay && month && year
                  ? 'bg-brand-red rounded-md py-3 items-center'
                  : 'bg-surface-alt rounded-md py-3 items-center'
              }
            >
              <Text
                className={
                  displayDay && month && year
                    ? 'font-ui text-button uppercase tracking-wide text-white'
                    : 'font-ui text-button uppercase tracking-wide text-text-tertiary'
                }
              >
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function WheelColumn({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
  testID?: string;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingVertical: 4 }}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      testID={testID}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            testID={testID ? `${testID}-option-${option.value}` : undefined}
            className="items-center justify-center mx-1 my-0.5"
            style={{
              height: 40,
              borderRadius: 8,
              backgroundColor: isSelected ? '#D80000' : 'transparent',
            }}
          >
            <Text
              className={
                isSelected
                  ? 'font-ui text-body font-bold text-white'
                  : 'font-ui text-body text-text-primary'
              }
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
