# Phase 4 verification

> Verified: 2026-09-07
>
> Scope: onboarding, PIN setup and change, lock screen with biometric
> auto-prompt and PIN fallback, lockout, auto-lock, privacy screen, share
> confirmation

## Outcome

The app now has a session. `SessionProvider` owns one status and the root
layout mounts routes behind `Stack.Protected` guards keyed on it, so nothing
past the lock screen exists in the navigator while locked. A hashed 6-digit
PIN is always available as the second door; biometrics or the device
credential is the first. [ADR 0003](../adr/0003-session-and-pin-model.md)
records the model and where each piece of state lives.

## Native run evidence

iOS, Expo SDK 57 development client, iPhone 17 Pro simulator, iOS 26.5,
Face ID enrolled:

1. Upgrade path. A vault from Phase 3 with three documents and no PIN record
   opens on onboarding, and the PIN screen is titled "Add a PIN to your
   vault" instead of "Choose a 6-digit PIN". After the PIN is entered twice
   and Face ID matches, Home shows the same three documents; the existing
   device key was kept rather than regenerated. Screenshots:
   `docs/images/onboarding-ios.png`, `onboarding-unlock-ios.png`,
   `pin-ios.png`.
2. Lock now. Settings, Lock now shows the lock screen and prompts Face ID at
   once. A simulated non-match shows the system "Face Not Recognized"
   dialog; Cancel returns to the keypad with no error text
   (`docs/images/lock-ios.png`). Before commit d668f04 the raw
   `BIOMETRIC_AUTH_FAILED` string from the native promise was shown here;
   cancelling is now resolved as `false` natively and known error codes map
   to plain sentences.
3. Wrong PIN. Entering 222222 shakes the dots and reads "Wrong PIN.
   4 attempts left before a pause." (`docs/images/lock-wrong-pin-ios.png`).
   The right PIN then opens Home.
4. Auto-lock. With the option set to Immediately, switching to the Settings
   app and back lands on the lock screen with the Face ID prompt; a match
   returns to Home. The option sheet is in
   `docs/images/settings-autolock-ios.png`. The row subtitle read "After
   immediately in the background" and now reads "As soon as you leave the
   app" (commit 2d4f36a).
5. Change PIN. Current PIN, new PIN, confirmation, then the "PIN changed"
   toast on Settings; the flow was run again to restore the original PIN.
6. Confirm before sharing. With the toggle on, Share on a document detail
   opens the Face ID step-up first, and the privacy blur covers the app
   behind the prompt (`docs/images/share-stepup-ios.png`). A match opens the
   share sheet.
7. Privacy screen. The blur is visible whenever the app is inactive, as in
   step 6. Screenshot blocking cannot be judged on the simulator because
   `simctl` captures the frame buffer regardless.

Android, Medium Phone emulator, API 36.1, fresh install of the debug APK:

1. Onboarding, then the PIN twice. With no screen lock on the emulator the
   PIN screen reports "Set up a screen lock in your device settings first."
   (the `NO_AUTH_ENROLLED` code mapped to a sentence) and stays on the first
   step. After `adb shell locksettings set-pin 1234`, the same PIN entry
   opens the system credential prompt, and entering the device PIN lands on
   the empty Home.
2. Lock now shows "Enter your PIN" with a "Use screen lock" button because
   no fingerprint is enrolled; the app PIN opens Home again.
3. The photo picker and the save that Phase 3 could not finish now complete
   without the vault locking behind the picker; see the Phase 5 note.
4. FLAG_SECURE keeps every screenshot black, so the screens were read with
   `uiautomator dump`.

## Defects found by the run

- The progress sheet was a native `Modal` presented while the photo picker
  was still dismissing. iOS never tore it down and its invisible window
  swallowed every touch afterwards, so Save could not be pressed. The
  progress card now renders inline inside the screen (commit 74fc14b).
- Cancelling the biometric prompt surfaced the native error code (above).
- The auto-lock subtitle wording (above).

Two testing notes for future runs: a synthetic tap shorter than about
100 ms lands on a `UISwitch` but does not toggle it, and the development
client's floating menu button swallows taps on header buttons next to it,
so it was turned off from the dev menu before testing Share and Delete.

## Quality gate

`npm run validate` passes: Prettier, ESLint, TypeScript 6 strict, Jest
(12 suites, 46 tests), Expo Doctor. Session tests cover the setup and locked
states, the biometric failure message, the PIN unlock, the lockout policy,
and that setup keeps an existing key.

## Deferred

- `.maestro/first-document.yaml` is written but not executed; Maestro is
  not installed on this machine.
- The rooted or modified device banner on the lock screen was not exercised.
- Optional local notifications for expiring documents.
