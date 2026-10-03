// How a player's cricket details read on screen. The server stores them as codes
// (BATTER, RIGHT_HANDED, RIGHT_ARM...); people should see "Batter", "Right-Handed",
// "Right-Arm". Same wording as the Profile tab and the Profile Setup choices.
const LABELS: Record<string, string> = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-Rounder',
  WICKET_KEEPER: 'Wicket-Keeper',
  RIGHT_HANDED: 'Right-Handed',
  LEFT_HANDED: 'Left-Handed',
  LEFT_ARM: 'Left-Arm',
  RIGHT_ARM: 'Right-Arm',
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

// Known codes use the labels above; anything else (a new option added on the server) is
// still made readable instead of shown as RAW_CODE: "SOME_NEW_VALUE" -> "Some New Value".
export function playerFieldLabel(value: string | null | undefined): string {
  if (!value) return '';
  if (LABELS[value]) return LABELS[value];
  return value
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
