import {
  Booking,
  CreateBookingInput,
  CreateMatchInput,
  CreateObligationsInput,
  CreateTeamInput,
  GameRoom,
  GatewayPaymentOrder,
  AudioTrigger,
  Innings,
  IntroContext,
  JoinRequest,
  LiveScore,
  Match,
  MatchAttendanceStatus,
  MatchResult,
  MyTeam,
  PlayingXiPlayer,
  RecordBallInput,
  Scorecard,
  ScoreEvent,
  OpenTeam,
  Payment,
  PaymentObligation,
  ReplacementSuggestion,
  TeamDetails,
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
  MyProfile,
  UpdateProfilePayload,
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

  // --- Module 2.2 Player Profile ---

  async getMyProfile(): Promise<MyProfile> {
    return this.request<MyProfile>('/profile/me');
  }

  async updateMyProfile(payload: UpdateProfilePayload): Promise<MyProfile> {
    return this.request<MyProfile>('/profile/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // Uploads a picked photo (as a React Native file-uri blob) to S3 and
  // returns the hosted URL. Throws (with a `status` on the error) if the
  // server has no photo storage configured (501) — callers should catch
  // that specifically and fall back gracefully rather than surfacing a
  // generic failure.
  async uploadProfilePhoto(
    fileUri: string,
    mimeType: string,
  ): Promise<{ profile_photo_url: string }> {
    const headers = new Headers();
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const extension = mimeType.split('/')[1] ?? 'jpg';
    const formData = new FormData();
    // React Native's fetch/FormData accepts this {uri, name, type} shape for
    // a file field — it is not a real Blob/File, but RN's networking layer
    // knows how to stream it from the given uri.
    formData.append('photo', {
      uri: fileUri,
      name: `photo.${extension}`,
      type: mimeType,
    } as unknown as Blob);

    const response = await fetch(`${this.baseUrl}/profile/photo`, {
      method: 'POST',
      headers,
      body: formData,
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

    return response.json() as Promise<{ profile_photo_url: string }>;
  }

  // Sends a 6-digit verification code to the given email — it is NOT saved
  // to the profile until verifyEmailOtp succeeds.
  async sendEmailOtp(
    email: string,
  ): Promise<{ message: string; dev_otp?: string; dev_email_error?: string }> {
    return this.request('/profile/email/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Verifies the code and, only then, persists the email onto the profile.
  async verifyEmailOtp(email: string, otp: string): Promise<MyProfile> {
    return this.request<MyProfile>('/profile/email/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  // ---- Module 2.4: Payments ----

  async createObligations(
    bookingId: string,
    input: CreateObligationsInput = {},
  ): Promise<{ results: PaymentObligation[] }> {
    return this.request<{ results: PaymentObligation[] }>(`/bookings/${bookingId}/obligations`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getObligations(bookingId: string): Promise<{ results: PaymentObligation[] }> {
    return this.request<{ results: PaymentObligation[] }>(`/bookings/${bookingId}/obligations`);
  }

  async initiateGatewayPayment(
    obligationIds: string[],
    paymentMethod: 'UPI' | 'RAZORPAY',
  ): Promise<GatewayPaymentOrder> {
    return this.request<GatewayPaymentOrder>('/payments/razorpay/order', {
      method: 'POST',
      body: JSON.stringify({ obligation_ids: obligationIds, payment_method: paymentMethod }),
    });
  }

  async recordCashPayment(obligationIds: string[], cashReference?: string): Promise<Payment> {
    return this.request<Payment>('/payments/cash', {
      method: 'POST',
      body: JSON.stringify({ obligation_ids: obligationIds, cash_reference: cashReference }),
    });
  }

  async getMyPaymentHistory(): Promise<{ results: Payment[] }> {
    return this.request<{ results: Payment[] }>('/payments/mine');
  }

  async getBookingPayments(bookingId: string): Promise<{ results: Payment[] }> {
    return this.request<{ results: Payment[] }>(`/bookings/${bookingId}/payments`);
  }

  // ---- Module 2.5: Teams ----

  async createTeam(input: CreateTeamInput): Promise<TeamDetails> {
    return this.request<TeamDetails>('/teams', { method: 'POST', body: JSON.stringify(input) });
  }

  async getMyTeams(): Promise<{ results: MyTeam[] }> {
    return this.request<{ results: MyTeam[] }>('/teams/mine');
  }

  async getOpenTeams(
    filters: { skill_level?: string; city?: string } = {},
  ): Promise<{ results: OpenTeam[] }> {
    return this.request<{ results: OpenTeam[] }>(`/teams/open${toQueryString(filters)}`);
  }

  async getTeamDetails(teamId: string): Promise<TeamDetails> {
    return this.request<TeamDetails>(`/teams/${teamId}`);
  }

  async inviteToTeam(teamId: string, playerId: string): Promise<{ invitation_id: string }> {
    return this.request<{ invitation_id: string }>(`/teams/${teamId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ player_id: playerId }),
    });
  }

  async respondToTeamInvitation(
    invitationId: string,
    accept: boolean,
  ): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/teams/invitations/${invitationId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    });
  }

  async removeTeamMember(teamId: string, playerId: string): Promise<void> {
    await this.request<void>(`/teams/${teamId}/members/${playerId}`, { method: 'DELETE' });
  }

  async leaveTeam(teamId: string): Promise<void> {
    await this.request<void>(`/teams/${teamId}/leave`, { method: 'POST' });
  }

  async changeCaptain(teamId: string, newCaptainPlayerId: string): Promise<void> {
    await this.request<void>(`/teams/${teamId}/captain`, {
      method: 'POST',
      body: JSON.stringify({ new_captain_player_id: newCaptainPlayerId }),
    });
  }

  async requestToJoinTeam(teamId: string): Promise<{ request_id: string }> {
    return this.request<{ request_id: string }>(`/teams/${teamId}/join-requests`, {
      method: 'POST',
    });
  }

  async getJoinRequests(teamId: string): Promise<{ results: JoinRequest[] }> {
    return this.request<{ results: JoinRequest[] }>(`/teams/${teamId}/join-requests`);
  }

  async respondToJoinRequest(requestId: string, accept: boolean): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/teams/join-requests/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    });
  }

  // ---- Module 2.6: Match Creation & Game Room ----

  async createMatch(input: CreateMatchInput): Promise<Match> {
    return this.request<Match>('/matches', { method: 'POST', body: JSON.stringify(input) });
  }

  async getMyMatches(): Promise<{ results: Match[] }> {
    return this.request<{ results: Match[] }>('/matches/mine');
  }

  async getGameRoom(matchId: string): Promise<GameRoom> {
    return this.request<GameRoom>(`/matches/${matchId}`);
  }

  async inviteToMatch(matchId: string, playerId: string): Promise<{ invitation_id: string }> {
    return this.request<{ invitation_id: string }>(`/matches/${matchId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ player_id: playerId }),
    });
  }

  async joinMatchViaLink(matchId: string): Promise<void> {
    await this.request<void>(`/matches/${matchId}/join`, { method: 'POST' });
  }

  async respondToMatchInvitation(
    invitationId: string,
    response: 'CONFIRMED' | 'MAYBE' | 'CANT_PLAY',
  ): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/matches/invitations/${invitationId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    });
  }

  async respondToMatch(
    matchId: string,
    response: 'CONFIRMED' | 'MAYBE' | 'CANT_PLAY',
  ): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/matches/${matchId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    });
  }

  async updateMyAttendance(matchId: string, status: 'RUNNING_LATE' | 'CHECKED_IN'): Promise<void> {
    await this.request<void>(`/matches/${matchId}/attendance/me`, {
      method: 'POST',
      body: JSON.stringify({ attendance_status: status }),
    });
  }

  async setPlayerAttendance(
    matchId: string,
    playerId: string,
    status: MatchAttendanceStatus,
  ): Promise<void> {
    await this.request<void>(`/matches/${matchId}/attendance/${playerId}`, {
      method: 'POST',
      body: JSON.stringify({ attendance_status: status }),
    });
  }

  async getCheckInCode(matchId: string): Promise<{ check_in_code: string | null }> {
    return this.request<{ check_in_code: string | null }>(`/matches/${matchId}/check-in-code`);
  }

  async checkIn(matchId: string, code: string): Promise<void> {
    await this.request<void>(`/matches/${matchId}/check-in`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async vacateMatchSpot(matchId: string, playerId: string): Promise<{ replacement_id: string }> {
    return this.request<{ replacement_id: string }>(
      `/matches/${matchId}/players/${playerId}/vacate`,
      { method: 'POST' },
    );
  }

  async getReplacementSuggestions(
    replacementId: string,
  ): Promise<{ results: ReplacementSuggestion[] }> {
    return this.request<{ results: ReplacementSuggestion[] }>(
      `/matches/replacements/${replacementId}/suggestions`,
    );
  }

  async inviteReplacement(replacementId: string, playerId: string): Promise<void> {
    await this.request<void>(`/matches/replacements/${replacementId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ player_id: playerId }),
    });
  }

  async acceptReplacement(replacementId: string): Promise<void> {
    await this.request<void>(`/matches/replacements/${replacementId}/accept`, { method: 'POST' });
  }

  // ---- Module 2.7: Countdown Intro ----

  async startMatchIntro(matchId: string): Promise<IntroContext> {
    return this.request<IntroContext>(`/matches/${matchId}/start`, { method: 'POST' });
  }

  async getMatchIntro(matchId: string): Promise<IntroContext> {
    return this.request<IntroContext>(`/matches/${matchId}/intro`);
  }

  async confirmPlayingXi(
    matchId: string,
    side: 'TEAM_A' | 'TEAM_B',
  ): Promise<{ players: PlayingXiPlayer[] }> {
    return this.request<{ players: PlayingXiPlayer[] }>(`/matches/${matchId}/intro/confirm-xi`, {
      method: 'POST',
      body: JSON.stringify({ side }),
    });
  }

  async recordToss(
    matchId: string,
    tossWinnerMatchTeamId: string,
    decision: 'BAT' | 'BOWL',
  ): Promise<{ toss_winner_match_team_id: string; toss_decision: string }> {
    return this.request(`/matches/${matchId}/intro/toss`, {
      method: 'POST',
      body: JSON.stringify({ toss_winner_match_team_id: tossWinnerMatchTeamId, decision }),
    });
  }

  async completeMatchIntro(matchId: string): Promise<void> {
    await this.request<void>(`/matches/${matchId}/intro/complete`, { method: 'POST' });
  }

  // ---- Module 2.8: Live Scoring ----

  async startInnings(
    matchId: string,
    input: {
      innings_number: number;
      batting_match_team_id: string;
      bowling_match_team_id: string;
      target_runs?: number | null;
    },
  ): Promise<Innings> {
    return this.request<Innings>(`/matches/${matchId}/innings`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async recordBall(
    inningsId: string,
    input: RecordBallInput,
  ): Promise<{ event: ScoreEvent; innings: Innings; audio_trigger: AudioTrigger }> {
    return this.request(`/innings/${inningsId}/balls`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async undoBall(inningsId: string): Promise<{ undone_event_id: string; innings: Innings }> {
    return this.request(`/innings/${inningsId}/undo`, { method: 'POST' });
  }

  async getLiveScore(matchId: string): Promise<LiveScore> {
    return this.request<LiveScore>(`/matches/${matchId}/live`);
  }

  async getScorecard(matchId: string): Promise<Scorecard> {
    return this.request<Scorecard>(`/matches/${matchId}/scorecard`);
  }

  async finalizeMatch(
    matchId: string,
    input: {
      result_type: 'WIN' | 'TIE' | 'NO_RESULT';
      winning_match_team_id?: string | null;
      winning_margin?: string | null;
      player_of_the_match_id?: string | null;
    },
  ): Promise<{ result_id: string }> {
    return this.request(`/matches/${matchId}/result`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getMatchResult(matchId: string): Promise<MatchResult> {
    return this.request<MatchResult>(`/matches/${matchId}/result`);
  }

  // ---- Module 2.9: Live Match Viewer Count ----

  async getViewerCount(matchId: string): Promise<{ active: number; total: number }> {
    return this.request<{ active: number; total: number }>(`/matches/${matchId}/viewers`);
  }
}

export type { SocialProvider };
