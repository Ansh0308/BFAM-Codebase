import { Audio } from 'expo-av';

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

let cache: Partial<Record<SoundTrigger, Audio.Sound>> = {};

// No-ops if the trigger has no source wired (see SCOPE NOTE above), if
// `enabled` is false (the turf's stadium_sound_enabled flag, or the
// viewer's own mute toggle), or if playback fails for any reason —
// missing sound must never break the surrounding feature.
export async function playTriggerSound(trigger: SoundTrigger, enabled: boolean) {
  if (!enabled) return;
  const source = SOUND_SOURCES[trigger];
  if (!source) return;

  try {
    let sound = cache[trigger];
    if (!sound) {
      const created = await Audio.Sound.createAsync({ uri: source });
      sound = created.sound;
      cache[trigger] = sound;
    }
    await sound.replayAsync();
  } catch {
    // Playback failure is never fatal to the feature it's decorating.
  }
}

export async function unloadAllSounds() {
  await Promise.all(Object.values(cache).map((sound) => sound?.unloadAsync().catch(() => {})));
  cache = {};
}
