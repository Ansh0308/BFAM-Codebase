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

// "5 min ago", "yesterday", "12 Oct" — for activity feeds and audit logs.
export function timeAgo(iso: string | Date, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const sec = Math.round((now.getTime() - then.getTime()) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.round(hr / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// BOOKING_CANCELLED -> "Booking cancelled"
export function humanize(code: string): string {
  const s = code.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
