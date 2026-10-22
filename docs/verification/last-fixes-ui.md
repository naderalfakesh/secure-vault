# Last UI fixes after the targeted re-QA

Branch `fix/last-ui`, from `fix/release-prep` 9827422. Scope is the UI
findings of the targeted native re-QA at 6f71574 (F4, F5, F6 and two Lows).
The security findings are in the parallel `fix/last-sec` lane; this lane does
not touch `modules/expo-vault`, `SessionProvider` or the unavailable screen.

Presentation only. Nothing changes in crypto, keys, the backup format, the
schema, what is stored or how the session locks. No simulator, emulator or
device was used and nothing native was built; the fixes are covered by Jest.

## F4: mid-word breaks at iOS AX5 (and the Android 2× Add document header)

Wrapping cannot keep a single word whole when the word is wider than the
line, and the earlier caps alone were not tight enough. Now:

- `Text` gets a `fit` prop, on by default for `largeTitle` and `title1`–
  `title3`. A fitted text gets `numberOfLines` equal to its word count,
  `adjustsFontSizeToFit` and `minimumFontScale` (`textScale.fitMinScale`,
  0.5). A word broken across lines would need more lines than words, so the
  native layout shrinks the font until every word is whole (both platforms
  shrink when the line count is exceeded). The helper is `wholeWordFit`.
  Fabric on iOS floors the shrink at 4 pt rather than `minimumFontScale`, so
  a title never truncates. User content that can be one long token (the
  viewer's document name, the "no matches" line quoting a search) opts out
  with `fit={false}` and wraps as before.
- Tighter caps in `textScale`: large titles 1.6× to 1.3×, bar and sheet
  titles 2× to 1.6×, and a new `segmentMax` of 1.6× for segment labels.
- Sheet titles and the Add document header are fitted, and at the
  accessibility text sizes (`useLargeText`, 1.7× and up) the title moves to a
  row of its own under the controls, the full width of the bar. That is also
  the Android 2× fix: the title no longer shares the row with two 96 dp sides,
  so it cannot collapse to just the X.
- `SegmentedControl` labels are fitted on one line and capped. At the
  accessibility sizes the control becomes a vertical list of the same radio
  options (44 pt rows, a check on the chosen one).
- `src/components/ui/__tests__/WholeWords.test.tsx` renders the large title,
  title headings, the sheet title, the Appearance segments and the Add
  document screen at fontScale 3.1 in a 320 pt window (and the header at 2×)
  and asserts the props are set.

## F5: two marks during the splash handoff

The glide failed two attempts, so it is gone, with its measuring
(`reportSplashTarget`, `planHandoff`, the lock screen's `measureInWindow`
reports, `Mark`'s `glyphStyle`). Now, when the native splash hides, the lock
screen is already drawn underneath with its own mark in place, and the splash
overlay (background and 72 pt mark together) cross-fades out over 200 ms
after one frame. Nothing travels, so there is never a second moving mark.

- The overlay colour comes from the system scheme, read with
  `Appearance.getColorScheme()` when the overlay mounts, before the stored
  Appearance is applied, and frozen. It matches the native splash, which
  always follows the system. Android used to follow the pinned app scheme and
  flipped light and dark.
- Kept: the 1.5 s hard stop (`HANDOFF_FALLBACK_MS`), no touches, hidden from
  assistive tech, and no screen transition while it runs. With reduced motion
  the overlay goes at once, with the native splash.
- **Change from the handover.** §3.5 asks for a "seamless" handoff, which the
  earlier work read as a glide of the splash mark onto the lock mark. A
  cross-fade over the lock screen, with its mark already in place, is the
  seamless result: one fade, no jump, no second mark. The 64 pt lock mark sits
  above the centred 72 pt splash mark, so for 200 ms the fading splash mark
  is seen over a fully drawn lock screen; neither mark moves.

## F6: RTL switches

Platform convention, documented in `Switch.tsx`:

- iOS: UISwitch mirrors itself from the semantic content attribute that React
  Native sets from the layout direction, so "on" is at the left in RTL. Our
  extra `scaleX: -1` undid that (the re-QA saw iOS "not mirrored"), so iOS now
  gets no transform.
- Android: Material puts "on" at the end, the left in RTL. The native switch
  does not take the layout direction from React Native, so it keeps the single
  mirror (the re-QA saw it mirrored once).

Both platforms now show "on" at the left in RTL, each by one flip only.

## Low: strength meter in dark with Reduce Transparency

The empty segments used `surfaceMuted`, which on the solid dark sheet
(`#1A2036`) is almost the sheet itself (`#1C2239`). They now use
`borderStrong`, the same track colour as the off switch. A test checks the
track's contrast against `surfaceElevated` in both themes.

## Quality gate

`npm run validate` exits 0 at HEAD (prettier, eslint, tsc, jest 86 suites /
810 tests, expo-doctor 20/20). With the machine at load 14 (a parallel lane
building), two of five full Jest runs lost a worker to a SIGSEGV (once in
`setup-pin.test.tsx`, a suite this lane does not touch); the reruns passed.

## Native check list

1. iOS AX5 (and an SE-size window): Library, Settings, Backup, Auto-lock and
   Protection large titles; the "One encrypted file, your passphrase" heading;
   the Encrypted backup and restore sheet titles; the Appearance control as a
   vertical list. No word breaks mid-word, nothing is truncated.
2. Android at its largest font (2×): the Add document header shows its title
   under the Cancel control; sheet titles and segments as above.
3. Cold start in light and dark, with a stored Appearance that differs from
   the system, on both platforms: one fade from the splash colours (system
   scheme) to the lock screen, no moving mark, no light/dark flip on Android;
   with Reduce Motion the overlay goes at once. Also a lockout launch.
4. RTL preview (`EXPO_PUBLIC_RTL_PREVIEW=1`): every switch shows "on" at the
   left on both platforms.
5. Dark with Reduce Transparency: the create-backup strength meter's empty
   track is visible.
