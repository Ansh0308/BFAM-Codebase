export type UserRole = 'PLAYER' | 'OWNER' | 'STAFF' | 'ADMIN';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface User {
  user_id: string;
  phone_number: string;
  email?: string;
  role: UserRole;
  account_status: AccountStatus;
  bfam_id: string;
  google_id?: string;
  apple_id?: string;
  is_minor: boolean;
  city?: string;
  preferred_language?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Player {
  player_id: string;
  user_id: string;
  bfam_id: string;
  playing_role?: string;
  batting_style?: string;
  bowling_style?: string;
  experience_level?: string;
  skill_rating: number;
  reliability_score: number;
  bio?: string;
  date_of_birth?: string;
  favorite_cricketer_name?: string;
  favorite_cricketer_external_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export type PaymentMethod = 'UPI' | 'CASH' | 'CAPTAIN_PAYS' | 'SPLIT' | 'CARD';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface Payment {
  payment_id: string;
  payer_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  gateway: string;
  gateway_order_id: string;
  gateway_payment_id?: string;
  payment_status: PaymentStatus;
  collected_by?: string;
  cash_reference?: string;
  initiated_at: string;
  completed_at?: string;
}

export type AudioTriggerType =
  | 'SIX'
  | 'FOUR'
  | 'WICKET'
  | 'FIFTY'
  | 'CENTURY'
  | 'HAT_TRICK'
  | 'MATCH_WON'
  | 'TOSS'
  | 'COUNTDOWN_START'
  | 'NONE';

export interface ScoreEvent {
  score_event_id: string;
  innings_id: string;
  over_number: number;
  ball_number_in_over: number;
  sequence_number: number;
  striker_player_id: string;
  non_striker_player_id: string;
  bowler_player_id: string;
  runs_scored: number;
  extra_type?: string;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type?: string;
  dismissed_player_id?: string;
  fielder_player_id?: string;
  audio_trigger: AudioTriggerType;
  recorded_by: string;
  recorded_at: string;
}

export interface Turf {
  turf_id: string;
  owner_id: string;
  turf_name: string;
  description?: string;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  ball_types_supported: string[];
  stadium_sound_enabled: boolean;
  turf_status: string;
  averagerating?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface MatchIntro {
  intro_id: string;
  match_id: string;
  countdown_enabled: boolean;
  background_music_enabled: boolean;
  playing_xi_confirmed_team_a: boolean;
  playing_xi_confirmed_team_b: boolean;
  intro_played_at?: string;
}

export interface LiveMatchSession {
  viewer_session_id: string;
  match_id: string;
  user_id?: string;
  socket_id: string;
  connected_at: string;
  disconnected_at?: string;
}
