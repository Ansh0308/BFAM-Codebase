import { apiClient } from '../lib/apiClient';
import { SelfServiceUserRole } from '@bfam/shared-types';

export interface AccountCreationInput {
  role: SelfServiceUserRole;
  identifier: string;
  password: string;
  signupToken: string | null;
  socialTicket: string | null;
  favoriteCricketerName: string | null;
  favoriteCricketerExternalId: string | null;
  // Liability waiver consent (PRD §32.9) — must be true; callers gate
  // their own "Continue" action on this rather than passing false, since
  // the backend rejects registration without it either way.
  waiverAccepted: true;
}

/**
 * Creates the BFAM account via whichever backend endpoint matches the
 * in-flight signup branch: POST /auth/register for phone/password signup
 * (optionally carrying a signup_token from OTP verification), or
 * POST /auth/social/complete for a brand-new Google/Apple user (carrying
 * the social_ticket + the phone number collected in social-phone.tsx).
 * Both return the same { token, user_id, bfam_id } shape.
 */
export async function completeAccountCreation(input: AccountCreationInput) {
  if (input.socialTicket) {
    return apiClient.completeSocialSignup({
      social_ticket: input.socialTicket,
      phone_number: input.identifier,
      role: input.role,
      favorite_cricketer_name: input.favoriteCricketerName,
      favorite_cricketer_external_id: input.favoriteCricketerExternalId,
      waiver_accepted: input.waiverAccepted,
    });
  }

  return apiClient.register({
    phone_number: input.identifier,
    password: input.password,
    role: input.role,
    signup_token: input.signupToken ?? undefined,
    favorite_cricketer_name: input.favoriteCricketerName,
    favorite_cricketer_external_id: input.favoriteCricketerExternalId,
    waiver_accepted: input.waiverAccepted,
  });
}
