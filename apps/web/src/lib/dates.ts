// Small date helpers for the dashboards. Booking dates are plain
// 'YYYY-MM-DD' calendar dates (India wall-clock), so everything here works on
// that string form and avoids timezone surprises from Date#toISOString.

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function formatDay(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return parseISODate(iso).toLocaleDateString(
    'en-IN',
    opts ?? { weekday: 'short', day: 'numeric', month: 'short' },
  );
}

export function formatRupees(n: number | string): string {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

export function hhmm(time: string): string {
  return time.slice(0, 5);
}
