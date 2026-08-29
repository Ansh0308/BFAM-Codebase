import {
  Booking,
  CreateBookingInput,
  TurfAvailability,
  TurfDetails,
  TurfListResponse,
  User,
} from '@bfam/shared-types';

export interface TurfListFilters {
  city?: string;
  q?: string;
  ball_type?: string;
  min_price?: number;
  max_price?: number;
  lat?: number;
  lng?: number;
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}

// Thrown by `request()` for any non-2xx response. Carries the backend's own
// clean error message (e.g. "This slot is no longer available...") and
// status code, so callers can branch on `status` instead of parsing text.
export class BFAMApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'BFAMApiError';
    this.status = status;
  }
}

function toQueryString(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  if (entries.length === 0) return '';
  const search = new URLSearchParams();
  for (const [key, value] of entries) search.set(key, String(value));
  return `?${search.toString()}`;
}

export class BFAMApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      let message = `BFAM API error: ${response.status} ${response.statusText}`;
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed?.error?.message) message = parsed.error.message;
      } catch {
        // Non-JSON error body — fall back to the generic message above.
      }
      throw new BFAMApiError(message, response.status);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  async getHealth(): Promise<{ status: string; uptime: number; timestamp: string }> {
    return this.request<{ status: string; uptime: number; timestamp: string }>('/health');
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // ---- Module 2.3: Turf Discovery & Booking ----

  async getTurfs(filters: TurfListFilters = {}): Promise<TurfListResponse> {
    return this.request<TurfListResponse>(`/turfs${toQueryString(filters)}`);
  }

  async getTurfDetails(turfId: string): Promise<TurfDetails> {
    return this.request<TurfDetails>(`/turfs/${turfId}`);
  }

  async getTurfAvailability(turfId: string, date: string): Promise<TurfAvailability> {
    return this.request<TurfAvailability>(
      `/turfs/${turfId}/availability${toQueryString({ date })}`,
    );
  }

  async createBooking(input: CreateBookingInput): Promise<Booking> {
    return this.request<Booking>('/bookings', { method: 'POST', body: JSON.stringify(input) });
  }

  async getMyBookings(scope: 'upcoming' | 'past' | 'all' = 'all'): Promise<{ results: Booking[] }> {
    return this.request<{ results: Booking[] }>(`/bookings/mine${toQueryString({ scope })}`);
  }

  async getBookingDetails(bookingId: string): Promise<Booking> {
    return this.request<Booking>(`/bookings/${bookingId}`);
  }

  async cancelBooking(bookingId: string, cancellationReason?: string): Promise<Booking> {
    return this.request<Booking>(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancellation_reason: cancellationReason }),
    });
  }
}
