# Final native QA: UI and UX fixes

Branch `fix/final-ui`, from `fix/polish-round2` 48673b1. Scope is the UI and
UX findings of the final native QA at 48673b1 (M3, M4, M5 and the Lows). The
security findings (H1, M1, M2) are in the parallel `fix/final-security` lane.

This lane changes presentation only. Nothing changes in crypto, keys, the
backup format, the schema or what is stored. Two small edits touch files near
the security lane and are listed under "Shared files".

No simulator, emulator or device was used and nothing native was built. The
fixes are covered by Jest; the native re-QA list at the end says what still
needs a device.

## M3: PIN screens on short windows

- `PinPad` sizes its keys from the window height (`pinPadMetrics`): 76 pt
  keys from 780 pt up (the design), then 68, 60 and 52 pt with tighter gaps.
  No step is below the 44 pt minimum. A 411 × 648 dp phone gets 60 pt keys.
- Lock, Choose PIN and Change PIN put their header (mark, title, subtitle,
  dots) in a scroll view that takes what the keypad leaves. The header never
  slides under the keys; at large text it scrolls. Short windows also tighten
  the space above the title and the dots.
- Keypad digits stop growing at 1.3×, so they stay inside the key.
- `src/__tests__/pin-screens-small-window.test.tsx` checks the layout budget
  (status bars + header + pad + footer fit) for heights from 568 to 932 pt,
  and renders all three PIN screens at 411 × 648.

## M4: largest text sizes (iOS AX5, Android 2×)

The caps are in `textScale` (`src/theme/tokens.ts`). Body text still scales
without a cap.

- **Large titles** stop at 1.6×, as the iOS large title does. "Library" no
  longer breaks one letter per line. The Library title row wraps, so Select
  and Sort move under the title when they do not fit beside it.
- **Tab labels** stop at 1.35×, like the system tab bar's, so "Library" and
  "Settings" never split mid-word. Each tab keeps its full accessible name.
  React Native has no large-content viewer, so the capped label is the
  fallback.
- **Bar titles** (the Add document header and sheet titles) stop at 2× and wrap
  whole words. The Add header lost its two-line limit, which caused the
  "Add a docu…" truncation.
- **List rows**: from 1.7× (iOS AX1 and up, Android's largest) the value moves
  under the title (`useLargeText`). Row text stops at 2.4×, so a single word
  such as "Immediately" always fits the row and wraps whole.
- **Android**: the clipped passphrase rule row ("Not the same character
  repeated") now wraps.

## M5: splash handoff

- The handoff measures the lock mark again right before the glide, and its own
  root in the same window coordinates. `planHandoff` takes the root's window
  offset, so the status-bar offset between the two cancels out.
- `SafeAreaProvider` gets `initialWindowMetrics`, so the lock mark does not
  move down by a status bar after the first measurement.
- While the handoff runs, stack screens appear with no transition, so the lock
  screen does not slide in on iOS. `SplashHandoff` reports `onDone` and the
  normal animation comes back after that.
- The overlay paints the native splash colours for the system scheme
  (`useColorScheme`): `#0A0D1A` with the `#1D2858` / `#8EA2FF` mark in dark,
  `#F5F6FA` with the indigo mark in light. `Mark` gained a `scheme` prop for
  this. The Android dark light-mark mismatch came from reading the app theme.
- Unchanged: the 1.5 s hard fallback, no touches, hidden from assistive tech,
  the cross-fade with reduced motion, and the fade when a lockout withdraws
  the target. The overlay still never covers the lock screen past the handoff.

## Lows

| Finding                                                          | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stale Library row after an index failure                         | Fixed. `DocumentService.reload` notifies lists even when the new index fails to open, and `useDocuments` drops its rows on any load error, so the Library shows the load failure instead of a row whose files are gone.                                                                                                                                                                                                                                     |
| "Unsupported backup" as a toast                                  | Fixed. A header the app cannot restore opens the restore sheet on that sentence with its one Close button, like the other outcomes.                                                                                                                                                                                                                                                                                                                         |
| No banner when Home closes the share chooser                     | Skipped. The banner says "SecureVault locked while you were sharing", and on that path the vault did not lock. The locked case is the H1 time-away fix in `fix/final-security` (`withoutAutoLock`). Once that lands, Home past the auto-lock limit locks the vault and the existing session-ended path marks the share. A banner for "the chooser closed and the vault stayed unlocked" would need a new reason in `SessionProvider`, which that lane owns. |
| Disabled erase-hold row gives no reason                          | Fixed. The subtitle says the erase waits for the backup being created, the restore that is running, or that the erase is running.                                                                                                                                                                                                                                                                                                                           |
| Android setup subtitle says "device passcode"                    | Fixed. Android says "screen lock".                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Create sheet has Cancel and X                                    | Fixed. Only Cancel, as on the Backup board (the error state keeps its Close button). `Sheet` has a new `closeButton` prop.                                                                                                                                                                                                                                                                                                                                  |
| ML Kit row with a success check; Android scanner sentence on iOS | Fixed. The disclosure is its own row with a neutral info icon. The Play services scanner sentence shows only on Android.                                                                                                                                                                                                                                                                                                                                    |
| Undo window 5 s vs the handover's 8 s                            | Kept at 5 s, on purpose. The undo keeps decrypted copies in the cache for `UNDO_WINDOW_MS` (8 s), which must outlast the toast. F8, the plaintext-free deferred delete, has not landed, so an 8 s toast would mean plaintext in the cache for longer. That is a security change, out of scope here. Match the handover when F8 lands.                                                                                                                       |
| Restore progress "of 33" vs toast "32 entries"                   | Fixed. Progress and "Stopped at entry" leave out the check entry.                                                                                                                                                                                                                                                                                                                                                                                           |
| RTL switch thumbs not mirrored                                   | Fixed. `Switch` mirrors itself when the layout is right to left, as `Icon` does for the SF Symbols.                                                                                                                                                                                                                                                                                                                                                         |
| Empty `pages_preview_*` after a failed import                    | Fixed. `previewForFile` removes its folder when the render fails or gives no page.                                                                                                                                                                                                                                                                                                                                                                          |
| iOS glass colour bleed around passphrase fields                  | Fixed. Inside a glass sheet (`OnGlassContext`), the field is a solid `surface` with a hairline edge.                                                                                                                                                                                                                                                                                                                                                        |
| Blank thumbnails seen once                                       | Skipped as asked: not reproducible.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Android launcher icon halo                                       | Skipped. The foreground is not the cause: `assets/adaptive-icon.png` is transparent apart from the glyph (x 382–641, y 348–675 of 1024, about 32% of the canvas), well inside the 66% safe zone. The halo is drawn by the launcher.                                                                                                                                                                                                                         |
| Dev-only Tools bubble and LogBox                                 | Skipped as asked: development builds only.                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Shared files

- `app/settings/backup.tsx` (`pickBackup`): one branch for `BACKUP_UNSUPPORTED`
  that opens the sheet instead of the toast. The picker copy is still
  discarded first, exactly as before.
- `src/features/backup/RestoreSheet.tsx`: an optional `problem` on
  `PickedBackup` sets the first stage, and the "Stopped at" label uses the new
  `stoppedAtLabel`.
- `src/services/DocumentService.ts`: `reload` notifies in a `finally`, and
  `previewForFile` cleans up its folder. No change to what is read or written.
- No edits to `SessionProvider.tsx`, `BackupService.ts` or `modules/expo-vault`.

## Quality gate

`npm run validate` exits 0 at HEAD (prettier, eslint, tsc, jest, expo-doctor).

## Native re-QA needed

1. Android at 411 × 648 dp, and an iPhone SE-size simulator: lock, Choose PIN
   and Change PIN (and the lockout and wrong-PIN states) show the title,
   subtitle and dots above the keypad.
2. iOS AX5 and Android at its largest font: Library title and header, tab
   labels, Settings rows (Auto-lock value under its title), the Add document
   header, the create backup sheet rules.
3. Cold start in light and dark on both platforms, with auto-lock on and with
   a stored Appearance that differs from the system: the mark lands on the
   lock mark with no second mark, the lock screen does not slide in, and
   Android dark shows the dark splash colours.
4. Restore a backup whose index will not open: the Library shows the load
   failure, not the old row. Pick a version-2 backup: the sentence shows in
   the restore sheet. Restore progress counts match the toast.
5. RTL preview (`EXPO_PUBLIC_RTL_PREVIEW=1`) on both platforms: switches show
   "on" at the leading edge. If a platform turns out to mirror natively, it
   shows up here as a doubled flip.
6. iOS 26+ glass sheets (create backup, restore): no colour bleed around the
   passphrase fields, in light and dark, with Reduce Transparency on and off.
7. Delete everything while an export or a restore runs: the reason line shows.
8. Import a PDF that cannot be rendered: no `pages_preview_*` folder is left in
   the cache.
