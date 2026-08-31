import { Feather } from '@expo/vector-icons';

export interface AvatarPreset {
  id: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  bg: string;
}

// Bundled icon-avatar presets — a substitute for hand-drawn cartoon art
// (not something this pipeline can produce). Stays within the existing
// brand palette (brand-red, ink-black, and a couple of warm neutrals) —
// never green, per Design §7 — rather than an arbitrary rainbow of colors.
// Selecting one stores `preset:<id>` in profile_photo_url (see
// Avatar.tsx and the backend's updateProfileSchema comment) instead of a
// real hosted URL.
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'bat-red', icon: 'crosshair', bg: '#D80000' },
  { id: 'ball-ink', icon: 'circle', bg: '#0D0D0D' },
  { id: 'gloves-gold', icon: 'shield', bg: '#A97A1F' },
  { id: 'trophy-red', icon: 'award', bg: '#D80000' },
  { id: 'target-ink', icon: 'target', bg: '#0D0D0D' },
  { id: 'bolt-gold', icon: 'zap', bg: '#A97A1F' },
  { id: 'star-red', icon: 'star', bg: '#D80000' },
  { id: 'flag-ink', icon: 'flag', bg: '#0D0D0D' },
  { id: 'fire-gold', icon: 'wind', bg: '#A97A1F' },
  { id: 'helmet-red', icon: 'shield', bg: '#D80000' },
  { id: 'medal-ink', icon: 'award', bg: '#0D0D0D' },
  { id: 'compass-gold', icon: 'compass', bg: '#A97A1F' },
];

export const PRESET_URI_PREFIX = 'preset:';

export function isPresetAvatarUri(uri: string | null | undefined): boolean {
  return Boolean(uri && uri.startsWith(PRESET_URI_PREFIX));
}

export function presetIdFromUri(uri: string): string {
  return uri.slice(PRESET_URI_PREFIX.length);
}

export function presetUriFromId(id: string): string {
  return `${PRESET_URI_PREFIX}${id}`;
}

export function findPreset(id: string): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((p) => p.id === id);
}
