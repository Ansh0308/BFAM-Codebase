// Stadium sound-effect manifest (modules 2.7's countdown sting and 2.8's
// AUDIO_TRIGGERS — six/four/wicket/fifty/century/hat-trick/match-won/
// toss/countdown). SCOPE NOTE, please read before wiring real assets:
//
// No audio files are bundled here. This environment has no way to source
// or verify non-copyrighted stadium sound effects (six/four/wicket/etc.)
// — every readily-available "cricket sound" clip online is either
// unlicensed or unverifiable, and bundling one without a checked license
// would risk exactly the copyright problem this was scoped to avoid. Per
// the module brief: flagging this explicitly rather than substituting a
// clip of unknown provenance.
//
// To wire real sounds: source CC0/public-domain clips (e.g. freesound.org
// filtered to CC0, or commission short original stings) and set each
// entry below to either a bundled `require('../../assets/sounds/x.mp3')`
// or a hosted https URL. Until then every trigger safely no-ops.
type SoundTrigger =
  | 'SIX'
  | 'FOUR'
  | 'WICKET'
  | 'FIFTY'
  | 'CENTURY'
  | 'HAT_TRICK'
  | 'MATCH_WON'
  | 'TOSS'
  | 'COUNTDOWN_START';

const SOUND_SOURCES: Record<SoundTrigger, string | null> = {
  SIX: null,
  FOUR: null,
  WICKET: null,
  FIFTY: null,
  CENTURY: null,
  HAT_TRICK: null,
  MATCH_WON: null,
  TOSS: null,
  COUNTDOWN_START: null,
};

// No-ops: no trigger has a source wired (see SCOPE NOTE above), so nothing plays and no
// audio library is loaded. When real clips exist, add an audio library that supports this
// Expo SDK (expo-audio) here. expo-av must not come back: its native library was built for
// an older React Native, failed to load on Android 15, and killed the app at launch with no
// message before any JavaScript ran.
export async function playTriggerSound(trigger: SoundTrigger, enabled: boolean) {
  if (!enabled) return;
  if (!SOUND_SOURCES[trigger]) return;
}

export async function unloadAllSounds() {}
