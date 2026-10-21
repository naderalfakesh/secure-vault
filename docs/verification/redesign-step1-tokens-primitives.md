# Redesign step 1 and 2: tokens, primitives, copy cleanup

Branch `feat/redesign`, based on `fix/polish-pass` 247d11f. Scope is handover
§9 steps 1 and 2, which have no gates. No screen was redesigned; call sites
changed only where a primitive's API changed.

## What changed

- **Tokens** (`src/theme`): the §3.1 palette in both themes, the §3.2 type
  scale (system font, `pinDigit` tabular), §3.3 radii, elevation (iOS box
  shadows, Android elevation 2 and 9), motion (shake, toast durations),
  control sizes, and the §3.4 icon grid.
- **Appearance**: `src/theme/appearance.ts` persists System / Light / Dark in
  its own secure-store entry, applies it to Unistyles and to native UI
  (`Appearance.setColorScheme`), and loads it at launch, so the lock screen
  follows it too. Settings uses the new SegmentedControl.
- **Icons**: outline SF Symbols on iOS; Feather, then Material Community
  outlines, on Android. Directional glyphs mirror in RTL on Android.
- **Primitives** (`src/components/ui`, tests in `__tests__`): Button,
  IconButton, ListRow, Switch, Group, SearchField, Chip, SegmentedControl,
  DocumentCard, DocumentRow, CollectionTile, Sheet, Toast, InlineAlert,
  ProgressBlock, PinPad, PinDots, EmptyState, TabBar, PrivacyCover, Mark,
  StrengthMeter, PassphraseField, FileCard, Banner, PaperThumbnail.
- **Copy**: intro step 2 now uses the §7.5 text (no "no cloud" claim); the
  privacy row no longer says "Blur"; `docs/SECURITY.md` and the plan no longer
  claim secure hardware or the Secure Enclave.

## Not done here, and why

- **Liquid Glass (F16)**: needs `expo-glass-effect`, a native dependency.
  TabBar and Sheet use the solid fallback. IconButton `glass` uses the
  existing `expo-blur`.
- **Exact SVG icons and mark**: drawing the handover paths needs
  `react-native-svg` (native). The mark uses `lock.doc` /
  `file-lock-outline` until an image asset ships.
- **TabBar is not wired** into `app/(tabs)/_layout.tsx`: the Library merge is
  step 4.
- **Toast countdown** is a ring with a ticking number, not a drawn arc (no
  SVG). With reduced motion it is static.
- **Dynamic Type cap**: `Text` keeps `maxFontSizeMultiplier={2}`; lifting it
  to AX5 belongs to the accessibility pass (step 9), when sheets scroll.

## Checks

- `npm run validate`: exit 0 (prettier, eslint, tsc, jest 53 suites / 350
  tests, expo-doctor 20/20).
- iOS and Android native runs: **not run** (native QA is a later milestone).
- Physical devices: not run.
