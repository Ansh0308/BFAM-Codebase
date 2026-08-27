**BFAM --- Design System Document**

Version 1.0 --- Extracted from Product Design Mockups (Home, Discover,
Turf Detail, Live Match, Player Profile)

---

**1. Color Palette**

Colors below were sampled directly from the mockups (pixel-level
extraction), not estimated. Where a value showed minor variance across
screens (anti-aliasing, gradient overlays), the most frequent/solid
sample is given as the canonical value.

**1.1 Brand Colors**

| Token                 | Hex       | Usage                                                                                                                                                                              |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand-red` (Primary) | `#D80000` | BFAM logo, primary buttons (Find a Game, Enter Game, Watch Live, Book This Turf), live rating numbers, active tab background, section accent underlines, diagonal geometric shapes |
| `brand-red-dark`      | `#B80000` | Pressed/active state for primary buttons (10--15% darker than `#D80000`)                                                                                                           |
| `brand-red-light`     | `#E85A58` | Tag/badge text on white (e.g. "Available" status text), lighter accent usage                                                                                                       |
| `ink-black`           | `#0D0D0D` | Primary headlines ("READY TO PLAY?", "DISCOVER"), player jersey graphics, bottom-nav active icon fallback, high-contrast photography overlays                                      |
| `pure-black`          | `#000000` | Logo wordmark strokes, icon fills, current-over score chips                                                                                                                        |

**1.2 Neutrals**

| Token              | Hex       | Usage                                                                      |
| ------------------ | --------- | -------------------------------------------------------------------------- |
| `surface`          | `#FFFFFF` | Card backgrounds, screen background base                                   |
| `surface-alt`      | `#F8F8F8` | App background beneath cards, subtle section separation                    |
| `border-subtle`    | `#EEEDEE` | Card borders, dividers between list rows                                   |
| `border-strong`    | `#E0E0E0` | Input field borders, tab dividers                                          |
| `text-primary`     | `#111111` | Body copy, numeric stats                                                   |
| `text-secondary`   | `#444444` | Labels ("QUICK ACTIONS", "NEAR YOU"), metadata (distance, time)            |
| `text-tertiary`    | `#767676` | Placeholder text ("Search turfs, players..."), disabled/booked-slot labels |
| `disabled-surface` | `#F3F3F3` | Unavailable/booked time-slot backgrounds                                   |

**1.3 Semantic Colors**

| Token               | Hex                              | Usage                                                                                                                                                                                                          |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `live-indicator`    | `#D80000` (same as brand-red)    | "LIVE" badge, live-dot, real-time viewer count icon --- BFAM does not use a separate green for "live"; red carries both brand and urgency                                                                      |
| `success/available` | `#D80000` (brand-red, not green) | "AVAILABLE" slot and turf-status text --- note this is a deliberate brand choice: BFAM uses red as the "positive/actionable" color rather than the conventional green, keeping the palette monochrome-plus-red |
| `rating-star`       | `#CE0002`                        | Star icons next to review scores                                                                                                                                                                               |

**1.4 Palette Rationale (for AI tools recreating the style)**

BFAM's palette is intentionally restrictive: **black, white, and one
red** --- no blue, green, or yellow anywhere in the sampled screens,
including status indicators that would conventionally be green
(available, live, success). This is what gives the UI its "sports
broadcast / stadium" feel rather than a generic app feel. When
generating new screens, do not introduce a second accent color; solve
new UI states (warnings, errors) with red-on-white, black-on-white, or
tonal grays only.

---

**2. Typography**

Exact font files aren't embedded in the source mockups, so the
recommendations below match the visual characteristics observed
(letterform weight, width, and case) rather than claiming to be the
literal typeface used.

**2.1 Headline / Display Font**

Large headlines ("READY TO PLAY?", "DISCOVER", "BFAM ARENA") use an
**extra-bold, condensed, all-caps grotesque** with tight letter
spacing and hard, geometric terminals --- built for maximum impact at
large sizes over photography.

- Recommended: **Anton**, **Archivo Black**, or **Bebas Neue**
  (Google Fonts, free, condensed/display weight match)
- Fallback stack: `'Anton', 'Archivo Black', Impact, sans-serif`
- Always set in uppercase; do not rely on CSS `text-transform` alone
  for headline type --- the mockups' letterforms are true caps, not
  transformed lowercase

**2.2 UI / Body Font**

Body copy, labels, buttons, and stat numbers use a **clean,
high-legibility grotesque** (SF Pro / Inter / Roboto family) --- not
condensed, moderate letter spacing, strong at small sizes.

- Recommended: **Inter** (closest open-source match to the
  numeral/label style seen for stats like "2,184", "74", "842")
- Fallback stack: `'Inter', -apple-system, 'SF Pro Display', Roboto, sans-serif`
- Numeric stats (BFAM Rating, runs, wickets, overs) use **tabular
  figures** at heavy weight (700--800) --- enable `font-variant-numeric:
tabular-nums` so scoreboard digits don't shift width as they update
  live

**2.3 Type Scale**

| Style               | Font                | Weight | Size (mobile, px) | Case                          | Example              |
| ------------------- | ------------------- | ------ | ----------------- | ----------------------------- | -------------------- |
| Hero Display        | Anton/Archivo Black | 900    | 56--64            | UPPER                         | "READY TO PLAY?"     |
| Screen Title        | Anton/Archivo Black | 900    | 40--44            | UPPER                         | "DISCOVER"           |
| Section Header      | Inter               | 800    | 22--26            | UPPER, small caps letterspace | "QUICK ACTIONS"      |
| Card Title          | Inter               | 800    | 20--22            | Title Case                    | "BFAM ARENA"         |
| Stat Number (large) | Inter               | 800    | 40--48            | ---                           | "842", "86/4"        |
| Stat Number (small) | Inter               | 700    | 18--22            | ---                           | "87", "2,184"        |
| Body / Metadata     | Inter               | 500    | 14--15            | Sentence case                 | "1.8 KM", "TODAY"    |
| Micro Label         | Inter               | 600    | 11--12            | UPPER, letterspaced           | "MATCHES", "WICKETS" |
| Button Label        | Inter               | 700    | 15--16            | UPPER                         | "FIND A GAME"        |

---

**3. Layout Structure & Grid**

**3.1 Base Grid**

- Design canvas: mobile-first, iPhone-class viewport (~375--393pt
  logical width)
- Base spacing unit: **8px**, with 4px used only for micro-adjustments
  (icon-to-label gaps)
- Screen horizontal margin: **24px** on both edges, consistent across
  every screen (Home, Discover, Turf Detail, Live, Profile)
- Section vertical rhythm: **32--40px** between major sections
  (e.g. Hero → Quick Actions → Next Game/Live cards → Performance)

**3.2 Structural Pattern (all screens)**

Every screen follows the same three-zone structure:

1. **Fixed header** --- logo/back button left, contextual actions
   (notification bell, avatar, share, live-viewer count) right
2. **Scrollable content** --- stacked full-width sections, each either
   a hero block, a horizontal-scroll card row, or a 2-column grid
3. **Fixed bottom tab bar** (mobile app only, 5 items) --- Home,
   Discover, Matches, Teams, Profile, with the active tab in
   `brand-red` and inactive tabs in `ink-black`/gray

**3.3 Grid Patterns Used**

| Pattern               | Where                                                                                      | Structure                                                   |
| --------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Full-bleed hero       | Home hero, Turf Detail hero                                                                | Edge-to-edge image/photo with text overlay, no card padding |
| 2-column card grid    | Quick Actions (4 items → 2x2 on narrow widths, 4-across on wider), Career stats (4-across) | Equal-width columns, 8--12px gutter                         |
| Horizontal scroll row | "Near You" turf cards, "Looking for Players"                                               | 3 cards visible with peek, 12--16px gutter, snap-scroll     |
| 2-up split card       | Next Game / Live Now (Home)                                                                | Two cards side by side, equal width, 12px gutter            |
| Single-column list    | Availability time slots, Reviews                                                           | Full-width rows or an evenly spaced horizontal chip row     |

---

**4. Component Styles**

**4.1 Buttons**

_Primary Button_ (Find a Game, Book Now, Enter Game, Watch Live, Book
This Turf)

- Background: `brand-red` `#D80000`
- Text: `#FFFFFF`, Inter 700, uppercase, 15--16px, letter-spacing ~0.5px
- Corner radius: **4--6px** (sharp, not pill-shaped --- matches the
  brand's angular/athletic feel)
- Padding: 16px vertical, 24px horizontal
- Icon: right-aligned arrow (→), same color as text, 8px gap from label
- Full-width within its container on primary CTAs; auto-width for
  inline actions

_Secondary/Ghost Button_ (implied pattern, e.g. filter toggle)

- Background: `#FFFFFF` or transparent
- Border: 1px solid `ink-black` or `border-strong`
- Text: `ink-black`, same type treatment as primary

**4.2 Cards**

- Background: `#FFFFFF`
- Corner radius: **8--12px**
- Border: 1px `border-subtle` (`#EEEDEE`), or borderless with a soft
  drop shadow (`0 2px 8px rgba(0,0,0,0.06)`) on elevated cards (Next
  Game, Live Now)
- Padding: 16--20px internal
- Image cards (turf listing): image fills top 60--65% of the card,
  edge-to-edge, with rounded top corners matching the card radius;
  text content below in a 12--16px padded block

**4.3 Tags / Badges**

- "LIVE" badge: solid `brand-red` fill, white uppercase text, 4px
  radius, small padding (4px x 8px)
- "AVAILABLE" / "BOOKED" status: text-only (no pill background) in
  `brand-red` (available) or `text-tertiary` gray (booked), paired
  with a small dot indicator of the same color
- BFAM ID badge (e.g. "BF1007"): `brand-red` text, Inter 700, no
  background --- functions as a colored label, not a chip

**4.4 Forms / Inputs**

- Search bar: full-width, `#FFFFFF` background, 1px `border-strong`,
  radius 8px, height ~48px, left-aligned magnifying-glass icon,
  placeholder text in `text-tertiary`
- Filter icon button: square, same height as search bar, `brand-red`
  background, white icon, radius matching the search bar (8px) so the
  two sit flush as one control

**4.5 Navigation**

- Bottom tab bar: 5 icons + labels, `#FFFFFF` background, top border
  1px `border-subtle`, active state = `brand-red` icon + label with a
  small red underline/indicator; inactive = `ink-black`/`#767676`
- Top app bar: transparent-over-hero on screens with a photographic
  header, solid white on list/detail screens

**4.6 Avatars & Media**

- Profile avatar: circular, 40--48px in headers, with a small red
  notification dot when unread alerts exist
- Player photo cutouts (hero imagery): desaturated/duotone treatment
  (black & white or near-monochrome) with a red diagonal geometric
  overlay shape behind the subject --- this diagonal red block is a
  recurring signature motif, not a one-off

---

**5. Overall Visual Mood & Aesthetic**

**Sports broadcast meets streetwear.** The design language borrows
from professional cricket/sports broadcast graphics (bold condensed
type, scoreboard numerals, high-contrast red/black/white) combined
with an athletic-apparel brand feel (diagonal geometric red shapes
behind hero photography, jersey-style player cards, "BF1007"-style
jersey numbering as a core identity element).

Key characteristics to preserve when extending the system:

- **Monochrome + one red.** No secondary accent color is ever
  introduced, including for success/error states.
- **High contrast, low ornamentation.** Flat fills, hard-edged
  geometry, minimal gradients (the only gradient use observed is
  subtle darkening on hero photography for text legibility).
- **Photography is desaturated or near-monochrome**, letting the red
  UI elements read as the only "color" on screen.
- **Condensed, oversized display type** paired with compact,
  functional UI type --- a deliberate contrast between editorial
  headlines and dense scoreboard-style data.
- **Angular, not rounded.** Buttons and diagonal brand shapes use
  sharp/slightly-rounded corners (4--12px radius range), never fully
  pill-shaped or soft --- reinforcing an athletic, precise feel over a
  friendly/playful one.
- **Data-forward.** Every screen surfaces live numbers prominently
  (viewer counts, live scores, ratings, career stats) styled as
  scoreboard/ticker elements, not buried in secondary text.

---

**6. Spacing & Sizing Guidelines**

**6.1 Spacing Scale (8px base unit)**

| Token     | Value | Usage                                               |
| --------- | ----- | --------------------------------------------------- |
| `space-1` | 4px   | Icon-to-label micro gaps                            |
| `space-2` | 8px   | Internal component padding (tags, tight stacks)     |
| `space-3` | 12px  | Card internal padding (compact), grid gutters       |
| `space-4` | 16px  | Standard card padding, button vertical padding      |
| `space-5` | 24px  | Screen horizontal margin, button horizontal padding |
| `space-6` | 32px  | Spacing between major page sections                 |
| `space-7` | 40px  | Spacing after hero sections                         |

**6.2 Corner Radius Scale**

| Token         | Value | Usage                                                        |
| ------------- | ----- | ------------------------------------------------------------ |
| `radius-sm`   | 4px   | Tags, badges, small buttons                                  |
| `radius-md`   | 8px   | Cards, inputs, primary buttons                               |
| `radius-lg`   | 12px  | Elevated/featured cards (Featured Turf, hero cards)          |
| `radius-full` | 50%   | Avatars only --- the only fully-round elements in the system |

**6.3 Icon & Touch Target Sizing**

- Bottom nav icons: 24px, minimum 44x44px touch target
- Quick Action icons: 32--36px within a 64--72px tappable card
- Avatar (header): 40--48px
- Avatar (player list/current batters): 32--40px
- Minimum touch target for any interactive element: **44x44px**
  (standard mobile accessibility minimum)

**6.4 Elevation**

- Flat cards (list items): no shadow, border only
- Elevated cards (Next Game, Live Now, Featured Turf): soft shadow
  `0 2px 8px rgba(0,0,0,0.06)` --- subtle, never a heavy drop shadow;
  depth is communicated mostly through red/white contrast and
  borders, not shadow

---

**7. Quick-Reference Token Sheet**

```
/* Colors */
--brand-red:        #D80000;
--brand-red-dark:    #B80000;
--brand-red-light:   #E85A58;
--ink-black:         #0D0D0D;
--pure-black:        #000000;
--surface:           #FFFFFF;
--surface-alt:       #F8F8F8;
--border-subtle:     #EEEDEE;
--border-strong:     #E0E0E0;
--text-primary:      #111111;
--text-secondary:    #444444;
--text-tertiary:     #767676;
--disabled-surface:  #F3F3F3;

/* Typography */
--font-display: 'Anton', 'Archivo Black', Impact, sans-serif;
--font-ui:      'Inter', -apple-system, 'SF Pro Display', Roboto, sans-serif;

/* Spacing */
--space-1: 4px;  --space-2: 8px;  --space-3: 12px;
--space-4: 16px; --space-5: 24px; --space-6: 32px; --space-7: 40px;

/* Radius */
--radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px; --radius-full: 50%;

/* Shadow */
--shadow-card: 0 2px 8px rgba(0,0,0,0.06);
```

---

_Source: color values pixel-sampled directly from the five provided
BFAM mockups (Home, Discover, Turf Detail, Live Match, Player
Profile). Typography and exact spacing are best-match recommendations
based on the mockups' visual characteristics, since font files and
design-tool measurements aren't recoverable from flattened images ---
verify against Figma/source files if pixel-perfect fidelity is
required._
