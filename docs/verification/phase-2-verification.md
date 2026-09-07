# Phase 2 verification

> Verified: 2026-09-07
>
> Scope: Unistyles theme, design-system primitives, lock gate, tab navigation, alert removal

## Outcome

The prototype's screens are gone. Every route now renders through a small
design system on Unistyles 3 tokens with light and dark palettes, the root
layout guards every document route behind a session lock, and routine outcomes
use sheets, toasts, and inline state instead of `Alert.alert`. Native alerts
remain for the two irreversible actions: deleting a document and emptying the
vault.

| Piece          | Where                   | Notes                                                                                                                                                                                  |
| -------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens         | `src/theme/`            | Color, spacing, radii, shadows, motion, system-font type scale that follows the iOS text styles, breakpoints. Dark palette mirrors light key for key (tested).                         |
| Primitives     | `src/components/ui/`    | `Text`, `Button`, `IconButton`, `Icon` (SF Symbols on iOS, Material on Android, one name vocabulary), `Chip`, `ListRow`, `Card`, `Screen`, `Sheet`, `Toast`, `EmptyState`, `Skeleton`. |
| Session        | `src/features/session/` | `SessionProvider` owns `setup`, `locked`, `unlocked`; the root `Stack.Protected` makes document routes unreachable while locked. Needs the new native `hasVault()`.                    |
| Navigation     | `app/(tabs)/`           | Home (search, recent, categories, scan CTA), Documents (search, chips, FlashList grid), Settings (lock, appearance, backup, about, danger zone).                                       |
| Document flows | `app/documents/`        | Add: source list, preview and details form, progress sheet, toast with View. Detail: preview, metadata cards, extracted text with copy and re-run, share, delete.                      |

## Native run evidence

iOS, Expo SDK 57 development client, iPhone 17 Pro simulator, iOS 26.5:

1. Cold start with an existing vault goes straight to the lock screen and
   auto-prompts Face ID; a simulated match lands on Home with the SDK 54
   document decrypted and its thumbnail in the Recent row.
2. Documents tab renders the FlashList grid with SF Symbols category chips and
   the search field.
3. Settings renders every section; choosing Dark repaints the whole screen,
   the tab bar, and the chips; System restores the OS scheme.
4. Home, Scan a document, Choose from Photos, pick a library photo, choose the
   Legal category, Save to vault: the progress sheet runs through reading,
   encrypting, and saving, the sheet closes, and Home already shows 2
   documents, the new one first in Recent and Legal counting 1, with no
   relaunch. Metro logged no errors.

Screenshots: `docs/images/home-ios.png`, `documents-ios.png`,
`settings-ios.png`, `settings-dark-ios.png`.

Android was built at the end of Phase 1 and is rebuilt in Phase 3 together with
the SQLite change, so the Phase 2 screens are verified on iOS only here.

## Quality gate

`npm run validate` passes: Prettier, ESLint with the React Compiler rules,
TypeScript 6 strict, Jest (6 suites, 17 tests: theme invariants, primitive
accessibility semantics, session provider, lock screen, document service
notifications and search, formatting), Expo Doctor 21/21.

## Issues found and fixed during verification

- Expo Router evaluates every route module before rendering, in path order, so
  `app/(tabs)/_layout.tsx` ran before `app/_layout.tsx` and a stylesheet
  touched the theme before `StyleSheet.configure`. Unistyles is now configured
  from a custom `index.js` entry that runs before the router (`98ba03f`).
- A horizontal chip `ScrollView` inside a flex column took the list's height;
  it is pinned with `flexGrow: 0` (`209b01e`).
- `SafeAreaView` from react-native-safe-area-context is not repainted by
  Unistyles on theme change; `Screen` now paints its background on a core
  `View` (`1f05b45`).
- Metro served stale bundles for a while because Watchman's state was left
  corrupted by the earlier process-limit crash; `watchman watch-del-all` and a
  clean start fixed it. Recorded in the toolchain notes, not in code.

## Deferred

- The lock screen still shows generic "Unlock" copy; biometric type detection
  and PIN fallback arrive in Phase 4.
- PDF preview and pinch-zoom wait for the Phase 7 viewer.
- Backup still exports to the clipboard or share sheet; Phase 8 replaces it.
