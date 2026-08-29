import {
  Booking,
  CreateBookingInput,
  TurfAvailability,
  TurfDetails,
  TurfListResponse,
  User,
  UserRole,
  SelfServiceUserRole,
  OtpPurpose,
  SocialProvider,
  SocialTicketResponse,
  AuthSuccessResponse,
  Cricketer,
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

export interface SendOtpResponse {
  message: string;
  dev_otp?: string;
}

export interface VerifySignupOtpResponse {
  signup_token: string;
}

export interface VerifyResetOtpResponse {
  reset_token: string;
}

export type VerifyOtpResponse =
  AuthSuccessResponse | VerifySignupOtpResponse | VerifyResetOtpResponse;

export interface RegisterPayload {
  phone_number: string;
  email?: string | null;
  password: string;
  role: UserRole;
  city?: string | null;
  preferred_language?: string | null;
  signup_token?: string;
  favorite_cricketer_name?: string | null;
  favorite_cricketer_external_id?: string | null;
}

export interface RegisterResponse {
  token: string;
  user_id: string;
  // Only set for PLAYER accounts (PRD §12.59, updated) — null for
  // TURF_OWNER/TURF_STAFF.
  bfam_id: string | null;
}

export interface CompleteSocialSignupPayload {
  social_ticket: string;
  phone_number: string;
  role: SelfServiceUserRole;
  favorite_cricketer_name?: string | null;
  favorite_cricketer_external_id?: string | null;
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

  // --- Module 2.1 Authentication & Onboarding ---

  async sendOtp(identifier: string, purpose: OtpPurpose): Promise<SendOtpResponse> {
    return this.request<SendOtpResponse>('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ identifier, purpose }),
    });
  }

  async verifyOtp(
    identifier: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<VerifyOtpResponse> {
    return this.request<VerifyOtpResponse>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ identifier, otp, purpose }),
    });
  }

  async login(identifier: string, password: string): Promise<AuthSuccessResponse> {
    return this.request<AuthSuccessResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  }

  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    return this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async forgotPassword(identifier: string): Promise<SendOtpResponse> {
    return this.request<SendOtpResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
    });
  }

  async googleAuth(idToken: string): Promise<AuthSuccessResponse | SocialTicketResponse> {
    return this.request<AuthSuccessResponse | SocialTicketResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });
  }

  async appleAuth(
    identityToken: string,
    name?: string | null,
  ): Promise<AuthSuccessResponse | SocialTicketResponse> {
    return this.request<AuthSuccessResponse | SocialTicketResponse>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identity_token: identityToken, name: name ?? null }),
    });
  }

  async completeSocialSignup(payload: CompleteSocialSignupPayload): Promise<RegisterResponse> {
    return this.request<RegisterResponse>('/auth/social/complete', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async searchCricketers(query: string): Promise<Cricketer[]> {
    return this.request<Cricketer[]>(`/cricketers/search?q=${encodeURIComponent(query)}`);
  }
}

export type { SocialProvider };
