# Redesign step 8: Share flow (J5) and lock during share (F7)

Branch `feat/redesign-share`, from `feat/redesign-backup` fe4bf73 (main with
T7b, core screens, onboarding, scan and the Backup hub). Scope is handover §9
step 8: the J5 share warning, the preparing step, the share-interrupted banner
(§6 J5, §7.4, §11.7), F7, and share staying single-document (§11.12).

No crypto, key, backup-format or schema change. The bounded auto-lock pause,
the lock gate, the residue sweeps and the share discard are unchanged or
stricter (see "Pause expiry while away").

## What changed

| Commit    | Change                                                                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `8f98497` | Each share copy goes in `cache/share/<uuid>/`, and an image copy is named `.jpeg`. `clearCache` also sweeps `expo-sharing-tmp`.                                                                          |
| `d9e1ad0` | A pause that is still pending once the time away passes both its own limit and auto-lock locks right then, without waiting for the return.                                                               |
| `abe3c88` | `shareInterrupted` in the session: `{ documentId }`, kept in memory only, cleared by Dismiss, Share again, or erase.                                                                                     |
| `e92a10a` | `vault.dismissShareSheet()`: on iOS it dismisses a presented `UIActivityViewController` and anything it presented. On Android it resolves `false`.                                                       |
| `5ab850e` | The root layout's lock effect calls it on every lock, next to the existing cache and backup sweeps.                                                                                                      |
| `b237178` | Viewer: the warning sheet (§7.4 copy, file card, Share or "Confirm with Face ID", Cancel), the preparing step after 400 ms with Cancel, and the banner. The lock outcome now sets the mark, not a toast. |
| `4c23862` | After the unlock that follows a lock, the root layout pushes `/documents/<id>` when the mark is set, so the banner is seen in the viewer.                                                                |

Share stays single-document: the Library's multi-select has only Move to… and
Delete, and this branch adds no share there.

## Residue findings fixed on the way

- **iOS staged hard link.** expo-sharing 58 stages the file whenever its
  extension differs from the declared type's preferred one. `public.jpeg`
  prefers `.jpeg`, and the copy was `Passport.jpg`, so every image share
  hard-linked the plaintext into `Caches/expo-sharing-tmp/<session>/<uuid>/`.
  Our discard removed only our name. The link stayed until the next share or
  launch, and the lock sweep didn't cover it. Now the copy is `.jpeg`, so no
  staging happens (PDFs were already `.pdf` for `com.adobe.pdf`), and the
  sweep removes `expo-sharing-tmp` for builds that left one.
- **Android reused grants.** expo-sharing calls `grantUriPermission` for every
  app that can take the share, and those grants outlive the file. The copy
  used one fixed path per title, so a later share of the same document had the
  same content URI and answered to every earlier grant while it existed. Now
  each copy has a fresh folder, so an old grant points at a path that never
  exists again.

## F7 per platform

**iOS.** When the vault locks with the sheet up, the lock effect calls
`dismissShareSheet()`. This walks each window's presented chain from its root
and dismisses the presenter of the activity controller with no animation, which
closes anything the sheet presented too (Mail, Save to Files). In the same
effect, `clearCache` removes the copy. In the viewer, the share is raced
against `session.ended()`, so its `finally` discards the copy and sets
`shareInterrupted`. expo-sharing exposes no dismissal, so the hook is in
`modules/expo-vault`. It runs on the main queue inside
`MainActor.assumeIsolated`.

Limits:

- A target the user already picked has already received the file. Dismissing
  can't take back what the other app copied, as §7.4 says.
- Whether UIKit calls expo-sharing's completion handler on a programmatic
  dismissal isn't confirmed. If it doesn't, that promise just stays pending:
  the viewer no longer waits on it, and the next share makes a new controller.

**Android.** The chooser is an activity of its own. The app can't dismiss it,
and while it is up the app counts as away. Before this branch, a chooser left
open meant no lock until the user came back, and the copy stayed readable
through its grant all that time. Now:

- A share pause that has been away longer than both its 2 minute limit and the
  auto-lock setting locks the vault then, from a JS timer. The lock sweep
  deletes the copy.
- A target picked from the lingering chooser afterwards opens a content URI
  whose file is gone. `FileProvider.openFile` fails, so the target gets
  nothing.
- With auto-lock set to Never, nothing locks, as before.
- The banner shows after the unlock.

Limits:

- The chooser stays on screen until the user closes it.
- A target picked before the lock has the content.
- JS timers only run while the process is alive. If Android kills the process,
  the cache is swept at the next launch.
- Grants aren't revoked (that would need native work). They point at deleted
  paths.
- `Activity.finishActivity(8524)` would close the chooser, but 8524 is
  expo-sharing's private request code, and after a pick it is forwarded to the
  target app's activity. So it isn't used.

**Pause expiry while away.** The timer only ever locks earlier than the return
check would have, with the same result: on return, a trip longer than the pause
limit is judged against auto-lock. If the user returns first, or the pause ends,
the timer does nothing. iOS suspends JS in the background, so there the return
check (or a timer firing on resume) does the work.

## Deviations

- The preparing step reads "Decrypting the document" with a spinner, not
  "Decrypting page n of N". The shared file is the document's one stored file,
  decrypted in a single native call with no per-page events, so a page count
  would not be true. Per-page progress would need native progress events.
- Cancel while preparing can't interrupt the native decrypt. It closes the
  sheet at once, and the copy is removed when it lands. A run counter
  guarantees that a cancelled copy never reaches a later share.
- A declined "Confirm with Face ID" keeps the warning open and shows the toast
  "Not confirmed, so nothing was shared." This is a routine outcome, so it
  isn't a native alert.
- Without biometrics, the confirm button reads "Confirm with passcode" (iOS) or
  "Confirm with screen lock" (Android).
- The lock outcome used to be a toast after unlock ("Sharing was cancelled…" or
  "SecureVault locked while you were sharing…"). It is now the banner on that
  document's viewer, reached automatically after the unlock that follows the
  lock. Back returns to the Library.

## Tests (written first, each seen failing)

- `DocumentService.test.ts`: `.jpeg` name, a fresh folder per copy with
  discard removing it, and the `expo-sharing-tmp` sweep.
- `SessionProvider.test.tsx`:
  - locks while away once a pending pause outlives its limit and auto-lock
  - waits for the auto-lock limit
  - never locks with Never
  - no lock after a pause that settled
  - the share-interrupted mark across lock and unlock, Dismiss and erase
- `lock-navigation.test.tsx`:
  - the lock dismisses the share sheet
  - the viewer comes back after the unlock when the mark is set
  - the Library comes back when it isn't
- `document-share.test.tsx`:
  - the warning (§7.4 copy and file card) and Cancel, with nothing prepared
  - Confirm with Face ID, declined then accepted
  - the preparing step after 400 ms, with Cancel removing the late copy
  - a cancelled copy never shared by the next run
  - a lock with the sheet open: copy discarded, mark set, no toast, the banner
    after the unlock, Dismiss
  - Share again reopening the warning
  - the banner only on the matching document
  - the existing lock-before-sheet and Android blocked-chooser cases, moved
    from the notice to the mark

## Checks

- `npm run validate`: exit 0 (prettier, eslint, tsc, 71 suites / 594 tests,
  expo-doctor 20/20). The "worker failed to exit gracefully" line also appears
  on fe4bf73.
- Android: `expo prebuild --platform android` then
  `./gradlew :expo-vault:compileDebugKotlin --max-workers=4` with JDK 17 passed.
  The generated `android/` was removed afterwards.
- iOS: the `dismissShareSheet` body typechecks against the iOS simulator SDK
  with Swift 6.4, in both Swift 5 and Swift 6 language modes, with no
  warnings. A full pod and Xcode build of the app was not run.
- Simulators, emulators and physical devices: not run.

## Native QA still owed

1. iOS: share an image and a PDF. Afterwards, nothing is left under
   `Caches/share` or `Caches/expo-sharing-tmp`.
2. iOS, auto-lock Immediately: open the share sheet, go home for more than
   2 minutes, then return. The sheet is gone and the lock screen shows. After
   the unlock, the viewer shows the banner, and Share again opens the warning.
3. iOS: the same with Save to Files or Mail open over the sheet. Both close.
4. iOS: lock by any path with the sheet up (also with the privacy cover).
   There is no sheet over the lock screen and no Main Thread Checker warning.
5. Android, auto-lock Immediately: open the chooser, wait more than 2 minutes
   without leaving it, then pick a target. The target gets no file (or an
   error), and on return the vault is locked and the banner follows the unlock.
6. Android: two shares of the same document get different content URIs.
7. Confirm before sharing on: Face ID cancel keeps the warning, and success
   shares.
8. A large PDF shows "Preparing a copy". Cancel leaves no file under
   `cache/share`.
9. VoiceOver/TalkBack: the banner is announced, its buttons are labelled, and
   the preparing step is announced. RTL: the banner and sheet mirror, and an
   Arabic title is isolated in the file card. Reduced motion: the sheet
   cross-fades.
