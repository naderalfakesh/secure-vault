# ADR 0003: Session lock model with a hashed PIN fallback

- Status: Accepted
- Date: 2026-09-07

## Context

The prototype had no session: a biometric prompt then `router.replace`. Any
deep link or cold start could land on a document screen, there was no
auto-lock, and a device without enrolled biometrics could not unlock at all
once the iOS key was bound to `biometryCurrentSet`.

The plan asks for onboarding, a PIN that always works as a fallback, an
auto-lock timeout, a privacy screen, and lockout after failed attempts. It
also asks to reuse Nadir Wallet's PIN hashing rather than write new crypto.

## Decision

### One session owner

`SessionProvider` holds a single status: `loading`, `setup`, `locked`,
`unlocked`, or `unavailable` (the device key or the PIN record could not be
read, so nothing is decided; see `docs/SECURITY.md`). The root layout wraps route groups in `Stack.Protected` guards
keyed on that status, so document routes do not exist in the navigator while
locked and no navigation call can reach them. Locking is a state change, not a
redirect.

### Two doors, one room

The vault's device key is gated by the OS (Face ID, Touch ID, or the device
passcode on iOS; biometrics or the device credential on Android). The app PIN
is a second door:

- `unlock()` runs the OS prompt through the vault module.
- `unlockWithPin(pin)` verifies the PIN against a stored record and then
  probes the device key with a tiny vault read. iOS satisfies that read with
  its own Keychain prompt when needed; on Android the Keystore key has a
  five-minute authentication window, so when the probe fails the provider
  runs the system credential prompt before declaring the session unlocked.
  The PIN therefore never bypasses the hardware key; it is the app-level gate
  in front of it.

### PIN storage

The PIN is stretched with PBKDF2-SHA256 (4096 iterations, 16-byte random
salt, 32-byte output) into a self-describing record
`pbkdf2-sha256$iterations$salt$hash`, ported from Nadir Wallet's
`crypto-core`, and stored with `expo-secure-store` (Keychain on iOS, the
Keystore-backed encrypted preferences on Android) so it can be read before
the vault's device key has been authenticated. The salt comes from
`expo-crypto`, because Hermes has no `crypto.getRandomValues`. A
6-digit PIN is a tiny keyspace, so this is defense in depth against a leaked
record, not a substitute for the OS gate. The plan suggested hashing in
native code; the JavaScript implementation was chosen because it is already
tested in a sibling project, runs under Jest, and the stretched record never
leaves the device's secure store (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) anyway.
Moving it to the module remains an option
if profiling shows the JS thread stalls on low-end devices.

### Lockout

Every fifth consecutive failure locks the keypad for 30 s, doubling each time
up to an hour. The state is persisted in the secure store next to the PIN
record, read at launch before the lock screen takes a PIN and again before
every attempt, and each attempt is judged against the stricter of the stored
copy and the one in memory, so neither a relaunch nor a failed write resets
it. A pause longer than its count earned is capped, and an unreadable state
is a 30-second pause that ends on its own. Wrong current PINs in Change PIN
count towards the same lockout. The device unlock still opens the vault and
resets the count. The policy is a pure module with tests
(`src/features/auth/lockout.ts`).

### Auto-lock and privacy

- `AppState` transitions record when the app left the foreground; on return
  the session locks if the idle time exceeds the setting (immediately, 1, 5,
  15 minutes, or never). The default is one minute.
- The privacy screen covers the app with a solid cover while inactive and enables screen-capture
  prevention while unlocked. Both follow one setting so a user who turns it
  off gets neither surprise.
- An optional step-up asks for biometrics again before a decrypted file is
  handed to the share sheet.

### Android key access window

The Android Keystore key is created with a 300-second authentication validity
window rather than per-use authentication, because per-use keys require a
`CryptoObject` on every cipher call and the module encrypts files in chunks.
Auto-lock bounds how long an unlocked session can exercise the key.

Auto-lock can be set to never, and a long session can outlive the window
while the app stays in the foreground. When that happens the Keystore
rejects the next cipher call with `UserNotAuthenticatedException`; the
module reports it under the `KEY_LOCKED` code and the JavaScript wrapper
around the native module (`withKeyRecovery`) shows the system credential
prompt once and retries the call. Screens never see the raw error, and iOS,
where the Keychain prompts on its own, is unaffected.

## Consequences

- Cold starts, deep links, and background returns all pass through the same
  gate; there is no second code path to keep secure.
- Setup is three onboarding slides, a PIN, and one OS prompt. There is no
  "create vault" button.
- The PIN record, lockout state, and settings live in the OS secure store,
  outside the vault, so the lock screen can read them before any prompt. A
  device key without a PIN record (the prototype's vault or an interrupted
  setup) goes through setup, which keeps the key and every entry under it and
  only adds a PIN. Because Android's secure store drops an entry it can no
  longer decrypt, each record has a plain marker file (M1): a PIN record that
  is gone while its marker says it was written is `unavailable`, never setup,
  and its "Set a new PIN" asks for the device key's own gate first. On iOS a
  reinstall's leftover Keychain items, found without the vault's files, are
  cleared at launch so the app goes to onboarding.
- Auto-lock pauses while a system picker, the camera, the scanner, or a
  step-up prompt is on screen; those send the app to the background without
  the user leaving it.
- Jest covers the provider's state machine, the lockout policy, PIN hashing,
  and settings sanitisation. The OS prompts themselves are verified by hand on
  simulators and recorded in the phase notes.

## Alternatives considered

- **PIN only, no OS gate.** Rejected; the hardware key is the reason the app
  exists.
- **Biometrics only.** Rejected; devices without enrollment and users who do
  not want biometrics would be locked out.
- **Per-use Keystore authentication with `CryptoObject`.** Stronger on paper,
  but it would prompt for every file operation. Reconsider if the module gains
  a single "session cipher" abstraction.
