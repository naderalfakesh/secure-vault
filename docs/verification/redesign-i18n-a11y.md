# Redesign step 9: string table, RTL (F17) and the accessibility pass

Branch `feat/redesign-i18n`, from `feat/redesign-share` b295c34 (every
redesigned screen J0–J8, plus main, T7b and polish). Scope is handover §9
step 9: F17 (§8), the copy deck (§7), the cross-cutting rules (§10.1–10.4)
and §11. Liquid Glass (F16) is not part of this step.

This pass changes presentation and strings only. There is no change to
behaviour, crypto, keys, the backup format, the schema, routes or data. Every
English sentence is byte-identical to what the screens showed before, so the
existing copy and security tests pass unchanged. The only test edits expect
the new U+2068…U+2069 isolation around user text inside spoken labels.

## String table (F17, §7, §10.1)

- `src/i18n/en/*.ts` holds one namespace per area: `common`, `format`, `ui`,
  `nav`, `lock`, `onboarding`, `unavailable`, `session`, `errors`,
  `changePin`, `library`, `viewer`, `scan`, `share`, `settings` and `backup`.
  `src/i18n/en/index.ts` merges them into the single English table `en`. Keys
  are fully qualified (`library.empty.title`), and a test checks that no
  namespace hides another namespace's key.
- **528 keys.** About 100 of them came from the per-feature copy modules
  (`backupCopy`, `scanCopy`, `shareCopy`, `lockCopy`, `onboardingCopy`,
  `protectionCopy`). Those modules keep their exported names and now read the
  table. The rest were hard-coded in screens, components and error sentences.
- `t(key, params)` fills `{name}` placeholders. `tp(key, count)` picks
  `.one`/`.other` (and any other CLDR form a future table adds) with
  `Intl.PluralRules` for the app's locale. `pluralize` (English only) is gone.
- `expo-localization` (`~58.0.5`, installed with `npx expo install`). Its
  config plugin is set to `supportsRTL: true`.
- `resolveLocale` picks the first of the phone's languages that has a table,
  and falls back to English. Dates use that locale's tag, which keeps the
  phone's region ("9 Oct" in en-GB, "Oct 9" in en-US).
- `src/i18n/__tests__/hardcoded-strings.test.ts` fails when a screen or
  component writes JSX text or a text prop (`label`, `title`,
  `accessibilityLabel`, …) as a literal.
- Not moved, on purpose: SQL, paths, test IDs, console text, heuristic
  keywords, error causes that never reach the screen, and the stored default
  title in the one-off legacy index migration, which is data.

**No Arabic table.** Neither §8 F17 nor §10.1 asks for translated strings,
and the brief forbids machine translation, so the app ships English only. An
Arabic table goes in `languages` in `src/i18n/index.ts` with
`direction: 'rtl'`. It uses the same keys, and any key it lacks falls back to
English.

## RTL decisions (§10.1)

- **Direction follows the language the app speaks.** `applyLayoutDirection()`
  runs from `index.js` before the router loads. It calls
  `I18nManager.allowRTL(rtl)` and `forceRTL(rtl)` only when the direction
  changes. React Native applies the setting from the next launch.
- English is the only table today, so an Arabic phone stays left to right and
  English never renders mirrored. Before this change, React Native Android's default
  `allowRTL` (on) could mirror English on RTL phones.
- Development builds can preview the mirrored layout with
  `EXPO_PUBLIC_RTL_PREVIEW=1`. Use this for the native RTL pass.
- Layouts already used start/end; this pass found no left/right styles left.
  Screen `edges={['left','right']}` lists physical safe-area edges, which is
  correct.
- Chevrons and back arrows mirror on both platforms. SF Symbols named for a
  side (`chevron.right`) do not flip by themselves, so the earlier iOS
  assumption was wrong. The keypad's backspace is not directional and never
  flips.
- PIN keypad and dots stay `direction: 'ltr'`. Keypad digits are Western
  Arabic numerals unless the locale tag asks for another numbering system
  (`-u-nu-arab`, `-u-nu-arabext`). In that case only the glyph changes, and
  the key still enters the same digit.
- Passphrases: no keyboard type, no normalisation, `writingDirection: 'auto'`.
  Tests type Arabic, Arabic-Indic and extended Arabic-Indic digits, Greek,
  CJK and Hebrew. The passphrase rules accept `٢٠٢٦١٢٣٤`, and it does not
  match `20261234` (a different passphrase, as before).
- **Isolation.** Every user title, file name, collection name, tag, field
  value and search query that sits inside a sentence or a composed label is
  wrapped with `isolate()` (U+2068…U+2069). This covers visible text and
  spoken labels: toasts, meta lines, the page label, chip remove labels,
  collection tiles, file cards and the "No matches for" line.
- **Pager maths.** Native scroll views report offsets from the left edge in
  both directions, but in RTL the first page sits at the right end.
  `pageFromOffset` and `offsetForPage` in `src/utils/pager.ts` (round trips
  tested both ways) now drive the viewer `PageStage` and the onboarding intro.
  FlatList's `scrollToIndex` already handles RTL itself.
- Arabic test title "عقد الإيجار 2026.pdf": the viewer (title and isolated
  page label), PageStage, the screen audit (Library and Viewer) and FileCard.

## Accessibility (§10.2)

- `Text` no longer caps font scaling (it was 2×), so Dynamic Type reaches AX5.
- `Sheet` scrolls its body. The three sheets that already scroll pass
  `scroll={false}`.
- Rows, cards, tiles, chips, buttons, segments, toasts and sheet titles wrap
  instead of truncating. The DetailsForm thumbnail caption keeps one line:
  it is hidden from screen readers and is not a row.
- `PinDots` speaks "N of 6 digits entered": as a live region on Android, and
  announced on iOS. An empty row is not announced, so a wrong-PIN reset
  leaves the error sentence to speak.
- `ProgressBlock` is a polite live region on Android. On iOS it is announced
  when it appears and then at most every 3 s (`useThrottledAnnouncement`), so
  "Checking 18 of 48" does not flood VoiceOver.
- Errors are alerts: InlineAlert danger, the lock, setup and change-PIN
  errors, the field errors, the Library load error and danger toasts. Each
  one is also announced on iOS, which does not speak an alert role when it
  appears. The lockout is announced once when it starts, not on every tick.
- "This can't be stopped" and the restore Cancel were already announced. The
  share "Preparing a copy" step now says "Cancel is available", and the
  processing step's announcement names Cancel.
- Icon-only buttons all have labels. `IconButton` requires one.
- `src/__tests__/accessibility-audit.test.tsx` walks 12 screens: Library and
  Viewer (both with the Arabic title), Settings, Auto-lock, Protection,
  Backup hub, Change PIN, Add a document, Intro, Choose a PIN, Biometrics and
  Lock. It fails on any control without a spoken name, and on any control
  whose stated size plus hit slop is under 44 pt. Controls sized only by
  padding can't be measured in Jest and are left to the native pass.
  `src/testing/accessibilityAudit.test.tsx` proves the audit catches both
  faults.

## Reduced motion (§10.3)

| Where                             | With reduced motion                                                      |
| --------------------------------- | ------------------------------------------------------------------------ |
| Stack screens, root and setup     | Cross-fade (`animation: 'fade'`) instead of the slide. New in this pass. |
| Viewer pager, from the page strip | Jumps instead of sliding. New in this pass.                              |
| Wrong-PIN shake                   | Off; text and colour only. Already in place.                             |
| Sheet                             | Cross-fade, no slide. Already in place.                                  |
| Toast                             | Fade instead of slide; undo countdown is static. Already in place.       |
| Onboarding intro                  | One step at a time, no slide. Already in place.                          |
| Skeleton pulse, EmptyState rise   | Off. Already in place.                                                   |
| Zoom and dismiss springs          | Reanimated's default `ReduceMotion.System` ends them at once.            |

## Light, dark and system (§10.4)

Checked by reading every screen:

- Colours come from theme tokens.
- The only fixed colours are the viewer's stage chrome and the glass
  IconButton, which are always dark (§11.14), plus the paper thumbnail lines
  and the Switch thumb.
- `applyAppearance` drives Unistyles and `Appearance.setColorScheme`, so the
  status bar (`auto`, `light` in the viewer), keyboards and alerts follow the
  Appearance setting rather than the system.
- No code reads `useColorScheme` directly.

No gaps were found, so nothing changed here.

## Checks

- `npm run validate` exited 0: prettier, eslint, tsc, jest (78 suites, 650
  tests) and expo-doctor (20/20 checks).
- Jest reports "a worker process has failed to exit gracefully" once per run.
  It is not tied to a failing suite.
- **Not run:** native builds, Metro, simulators, emulators and physical
  devices. The new `expo-localization` dependency and everything below are
  verified at the final native QA.

## Native QA owed

1. **Build.** `npx expo prebuild --clean`, then iOS and Android builds with
   expo-localization. Check that `android:supportsRtl="true"` is in the
   manifest.
2. **RTL pass.** Use a dev build with `EXPO_PUBLIC_RTL_PREVIEW=1`, relaunch
   once, then check on both platforms:
   - Every board mirrors. Chevrons and back arrows point the other way.
   - The PIN pad and dots stay left to right.
   - The intro and viewer pagers swipe, count and jump to the right page.
   - The page strip scrolls to the right page.
   - Toasts, rows and sheets align to the start.
   - "عقد الإيجار 2026.pdf" reads correctly in the Library rows, the viewer
     title, the delete toast and the share file card.
   - Then turn the preview off, relaunch, and confirm the app is back to left
     to right.
   - On an Arabic-locale phone, the app stays left to right in English.
   - With `ar-EG-u-nu-arab`, the keypad shows Arabic-Indic digits and unlocks
     with the same PIN.
3. **AX5.** Set the largest accessibility text size and walk every board:
   - Sheets scroll to their last button: restore, create backup, delete
     everything, move, sort, details, share.
   - Rows and cards wrap.
   - The tab bar and the PIN pad stay usable.
4. **VoiceOver and TalkBack on every board**:
   - Every control has a name.
   - Digit count on each key.
   - Wrong PIN and lockout are spoken once.
   - Progress during check, restore, backup and processing is spoken without
     flooding.
   - "This can't be stopped" and Cancel are spoken when they appear.
   - Field and load errors are spoken.
   - The unavailable title is a header and "Trying again…" is spoken.
5. **Reduced motion.** Screens cross-fade, there is no shake, the undo
   countdown is static, and the pager jumps.
6. **Appearance.** In System, Light and Dark, walk every board. The viewer
   stage stays dark.
