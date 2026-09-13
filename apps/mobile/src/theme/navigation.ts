// Backlog D-1: one deliberate motion language for screen-to-screen
// navigation, applied consistently at every Stack navigator's
// screenOptions rather than tuned per-screen. `slide_from_right` reads as
// "moving forward into a new screen" on both platforms — the same feel a
// native iOS push already has, extended to Android too, so a screen
// change never falls back to the bare, undesigned platform default.
export const SCREEN_TRANSITION = 'slide_from_right' as const;
