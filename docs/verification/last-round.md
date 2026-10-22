# Last fix round before device testing

> Verified: 2026-10-22 (host only: `npm run validate`; no native build, no
> simulator or emulator run, see "iOS checks owed")
>
> Base: `qa/last` at `390dca1`, findings from the combined native pass on it.
> Branch: `fix/last-round`. No security or data behaviour changed.

## Fixes

### iOS restore picker stuck after "Choose another file" (Medium)

Cause: "Choose another file" closed the restore sheet and called
`getDocumentAsync` in the same tick. The sheet is a React Native `Modal`, so
on iOS the top view controller was still the modal's. expo-document-picker
(58.0.4, `DocumentPickerModule.swift`) sets its `pickingContext` before it
presents, and presents on that view controller. The modal's dismissal then
took the picker down with it without calling the picker delegate, so
`pickingContext` was never cleared: the first promise never settled, and every
later call threw `PickingInProgressException` ("Different document picking in
progress") until a relaunch. The screen showed that raw text in a toast.

Fix (`app/settings/backup.tsx`, `Sheet`, `RestoreSheet`):

- The restore sheet now keeps its instance when it closes (keyed per pick, not
  by `uri ?? 'none'`), so its `Modal` reports `onDismiss`. The picker opens
  from that callback, with a fallback timer (1 s on iOS, 250 ms on Android,
  where `Modal` has no `onDismiss`) and a once-only guard. The closed sheet
  clears its passphrase state.
- A picker refusal with `ERR_PICKING_IN_PROGRESS` is retried once after
  600 ms. Any picker failure now shows "The file picker couldn't open. Try
  again in a moment." and never the module's text; the next tap tries again.
- A native flag that is already stuck cannot be cleared from JavaScript
  without patching the module (a native change, out of scope); the ordering
  fix is what prevents it.
- Tests: `backup-hub.test.tsx` "Backup hub picker after Choose another file"
  (waits for the dismissal, fallback, retry, plain sentence).

### Splash colour flip with a pinned Appearance (Medium, both platforms)

Cause: `RootNavigator` returned the overlay alone before the session was
ready and as the second child of a fragment after it. React remounted it at
that switch, and the new instance read `Appearance.getColorScheme()` again,
after the pinned scheme had been applied, so it flipped to the pinned colours
just before the fade.

Fix (`app/_layout.tsx`, `SplashHandoff.tsx`):

- The overlay is keyed and a child of the same fragment in both returns, so
  it keeps the system scheme it froze at mount.
- While it shows it mounts a `StatusBar` in the system scheme; the pinned one
  from the root applies when it unmounts.
- When the pinned Appearance differs from the system scheme there is no
  cross-fade: the overlay stays fully opaque in the system colours for the
  length of the fade (200 ms, also with reduced motion), then goes in one
  frame. A light-to-dark cross-fade reads as a flicker and the screen
  underneath may still be settling into the pinned theme, so one clean switch
  was chosen over a fade. Matching schemes keep the 200 ms fade.
- Tests: `SplashHandoff.test.tsx` "when the pinned Appearance differs".

### iOS AX5 (Medium and Lows)

- Lock screen: the title and subtitle are capped at 1.6× (`barTitleMax`) and
  the subtitle fits its words. The PIN dots moved out of the scrolling header
  to sit right below it, so they are always on screen; the insecure-device
  banner has its own small scroll area below them. Same spacing at default
  sizes. `pin-screens-small-window.test.tsx` updated.
- Backup card heading capped at 1.6× (it still fits its words).
- Library section titles are capped and shrink, so "See all" stays whole.
- Document row titles capped at 2× (`textScale.rowTitleMax`), so a word such
  as "Vaccination" fits the row.

### iOS RTL switches (Medium)

`4088229` left the iOS switch to mirror itself natively. QA on iOS 27 showed
"on" at the right. The single `scaleX: -1` flip is back on both platforms, so
"on" sits at the left in RTL. `Switch.test.tsx` covers both platforms.

## Skipped on purpose

- iOS 11-entry restore check finishing in one burst so Cancel cannot land:
  inherent to a small backup (about 90 ms); a large backup cancels correctly.
- iOS copied text staying on the pasteboard while the app is away; it is
  cleared on return to the lock screen.
- iOS create-backup sheet staying white after a live switch to dark with
  Reduce Transparency; correct after a relaunch.
- Android font-scale change relocking the vault (activity recreation).
- Dev-only items (dev-client bubble, LogBox linking error).

## Result

`npm run validate`: exit 0 (prettier, eslint, tsc, 86 suites / 838 tests,
expo-doctor 20/20).

## iOS checks owed (device or simulator)

1. Damaged backup, "Choose another file": the picker opens; Cancel, then
   "Restore from a backup…" opens it again; no raw toast.
2. Splash with system dark and pinned light, and the reverse, plus reduced
   motion: no colour flip on the overlay or status bar; one switch.
3. AX5: lock title whole, subtitle and dots visible; backup card heading,
   "See all" and document row titles whole.
4. RTL preview: switches show "on" at the left (and Android still does).
