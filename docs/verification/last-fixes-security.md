# Last security fixes verification

> Verified: 2026-10-22 (partial: Jest, a Mac Catalyst harness over the
> backup container and the restore cancel flag, and an Android module
> compile; no simulator, emulator or device, see "Not verified")
>
> Scope: F1, F2 and F3 and four Lows from the targeted native re-QA at
> `6f71574`. Branch `fix/last-sec`, based on `fix/release-prep` `9827422`.
> No backup format, crypto or key change.

| Item                                                          | Outcome | Commit               |
| ------------------------------------------------------------- | ------- | -------------------- |
| F1 iOS restore check: events late, cancels refused            | Fixed   | `7bb71a9`, `629e537` |
| F2 Android Home from the share chooser stays unlocked         | Fixed   | `de66e44`, `8cb8a57` |
| F3 Android lost PIN and removed screen lock goes to setup     | Fixed   | `60e2ea3`            |
| Low lost-PIN hint names every platform's unlock method        | Fixed   | `1e3a0a3`            |
| Low "Enter your PIN" after a cancelled prompt for a lost PIN  | Fixed   | `bbdc46c`            |
| Low raw "file is not a database" in the Library               | Fixed   | `ef9de8a`            |
| Low Face ID turned back on by a new PIN after it was declined | Fixed   | `69dc6b9`            |

**F1, root cause.** The native restore was never on the JavaScript thread:
`importBackup` is an `AsyncFunction` on Expo's async queue, its progress
goes through `runtime.schedule`, and `cancelRestore` is a synchronous
`Function` on the JavaScript thread that only flips `RestoreCancelFlag` under
its `NSLock`. The QA timestamps show the JavaScript thread itself busy for
140 to 450 ms from the native call on: the sheet starts the restore in the
same tick as it switches to Checking, so the native call begins before that
render (keyboard dismissal, sheet re-layout, announcements, development
logging). The iOS check of a small backup is shorter than that render:
CommonCrypto's PBKDF2 at 600,000 iterations takes 80 to 110 ms on this Mac,
and 11 small entries verify in about 1 ms. So the check and its last cancel
point passed under the render, every Checking event waited on the busy
thread and arrived together, and a cancel (a tap or the QA's CDP call) ran
only afterwards and was refused. Android's PBKDF2 takes about ten times as
long, so its check outlasts the render.

**F1, fixes.** `RestoreSheet` now draws Checking and waits one frame before
it calls the service, so the JavaScript thread is idle while the check runs;
a Cancel pressed in that frame stops the restore before the module is
called, with "Restore cancelled. Nothing was changed.". Separately, Expo 58
runs every module's async functions on one shared serial queue, so a long
restore or export held up every other module's async calls (the secure
store's PIN read on the lock screen, the index queries) for as long as it
ran. The iOS module's vault file calls now run on a serial queue of their
own (`vault-io`), in the order JavaScript made them, so they stay ordered
with each other as before; the keychain and biometric calls stay on Expo's
queue, and `cancelRestore` stays synchronous on the JavaScript thread. The
run-id rules, T7b's pre-pass, the preflight, F2's cancel points and the wipe
boundary are unchanged.

**F2.** Android delivers the chooser's result with `onActivityResult`, which
runs only when the activity resumes. Home from the chooser therefore settled
the share on the return, still "away", within its bound, and the return
grace for a picker result (under 1 s) excused it. With "Immediately" it
stayed open whenever the result landed first (3 of 4 runs). The chooser is
translucent, so it leaves the activity paused; the module now records when
an activity of the app is stopped (`lastStoppedAt`, from
`ActivityLifecycleCallbacks`, ignoring configuration changes; iOS answers
0). A stop after a share pause began means the user left the app: whether
the result or the return comes first, the pause excuses the time up to the
stop and the time since is judged against auto-lock without the grace. Back
within the bound is unchanged, and a stop from before the pause is ignored.

**F3.** Removing the Android screen lock deletes the Keystore key. With the
PIN marker but no PIN record and no key, launch treated the lost PIN as
absent and went to setup, which made a new key over the old entries and left
an index nobody can read. Launch and setup now treat a missing key with
entries left (the key probe alone does not count) as the L3 state, with or
without a PIN marker: `unavailable` with `keyInvalidated`, a plain sentence
("The key that opens this vault is no longer on this phone…") and "Delete
everything" as the only way on. Setup reads the state again and refuses the
same way. After the erase, setup starts as usual.

**Lows.** The lost-PIN hint names Face ID or Touch ID and the passcode on
iOS, and fingerprint, face or screen lock (or just screen lock) on Android.
A cancelled prompt there says "The device key was not unlocked, so no new
PIN was set. Try again.". The Library maps SQLite's "file is (encrypted or
is) not a database" to "The document index could not be opened, so it stays
closed. Nothing was changed.". Setup now saves the stored settings instead
of the defaults, so a new PIN after a lost one (which offers no biometrics
step) keeps a declined Face ID declined; "Delete everything" removes the
settings, so a vault set up after it starts from the defaults.

## Checks

- `npm run validate`: exit 0 (prettier, eslint, tsc, 85 suites / 820 Jest
  tests, expo-doctor 20/20).
- New Jest tests: Checking is on screen when the native restore starts, and
  a Cancel before it starts calls nothing (backup hub); Home from the chooser
  with the result first or the return first, a 1-minute auto-lock counted
  from the stop, and a stop before the pause ignored (session); entries
  without a key with and without a PIN marker, the key going after launch,
  a lone key probe, and the erase way out (session and the unavailable
  screen); the platform hints, the cancelled-prompt sentence, the index
  sentence, and the kept biometric choice. Run on the code before each fix,
  the F1 (2 of 2), F2 (3 of 5; the two that pass are controls), F3 and
  Face ID tests fail.
- Three screen suites seeded documents before the device key existed; they
  now create the key first, as a real vault has it.
- F1 harness (Mac Catalyst, the worktree's `BackupContainer.swift` and
  `VaultCrypto.swift` unchanged):
  `~/.hermes/profiles/portfolio/securevault-evidence/last-sec/harness/` runs
  a 24-entry restore on its own serial queue with progress hopped to the main
  thread, and cancels from the main thread. All 12 rows pass: no main-thread
  gap over 7.6 ms, 25 Checking events streamed over 80 to 110 ms, a cancel
  after the third Checking event answered true at once and the restore
  stopped with nothing handled, a cancel after the first Restoring event
  answered false and the restore finished, and the run-id rules held.
- Android: `:expo-vault:compileDebugKotlin` (JDK 17, `--max-workers=4`)
  exit 0 after a clean prebuild; the generated project and build folders
  were removed afterwards.

## Not verified

- No iOS build: the Swift changes (`runOnQueue(vaultQueue)` on the vault
  file calls, `lastStoppedAt`) are not compiled.
- Nothing ran in the app on a simulator, emulator or device.

Native check list:

1. iOS build, then the F1 restore of an 11-entry backup: Checking events
   arrive one by one, a Cancel tapped during Checking is honoured, and the
   restore otherwise completes. A long restore behind the lock: the PIN
   unlock answers while it runs.
2. Android, auto-lock Immediately: Home from the share chooser within 2
   minutes locks on return; Back within the bound stays open; a 1-minute
   setting counts only the time since Home; rotate with the chooser up does
   not lock.
3. Android, lost PIN and the screen lock removed: the unavailable screen
   with the plain sentence and only "Delete everything", which leads to
   setup.
4. iOS: decline Face ID at setup, lose the PIN record, set a new PIN: Face
   ID stays off. The Library shows the plain index sentence for an index it
   cannot open.
