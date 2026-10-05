import type { TournamentStatus } from '@bfam/shared-types';

export const FORMAT_LABEL: Record<string, string> = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_KNOCKOUT: 'League + knockout',
};

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: 'Coming soon',
  REGISTRATION_OPEN: 'Entries open',
  IN_PROGRESS: 'Live',
  COMPLETED: 'Finished',
  CANCELLED: 'Cancelled',
};
