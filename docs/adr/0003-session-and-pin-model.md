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

`SessionProvider` holds a single status: `loading`, `setup`, `locked`, or
`unlocked`. The root layout wraps route groups in `Stack.Protected` guards
keyed on that status, so document routes do not exist in the navigator while
locked and no navigation call can reach them. Locking is a state change, not a
redirect.

### Two doors, one room

The vault's device key is gated by the OS (Face ID, Touch ID, or the device
passcode on iOS; biometrics or the device credential on Android). The app PIN
is a second door:

- `unlock()` runs the OS prompt through the vault module.
- `unlockWithPin(pin)` verifies the PIN against a stored record, then relies
  on the same OS-gated key to read that record. On a device without enrolled
  biometrics the OS falls back to the passcode prompt, so the PIN path never
  bypasses the hardware key; it is a fallback for the biometric prompt, not
  for the Keychain or Keystore.

### PIN storage

The PIN is stretched with PBKDF2-SHA256 (4096 iterations, 16-byte random
salt, 32-byte output) into a self-describing record
`pbkdf2-sha256$iterations$salt$hash`, ported from Nadir Wallet's
`crypto-core`, and stored as a vault entry encrypted by the device key. A
6-digit PIN is a tiny keyspace, so this is defense in depth against a leaked
record, not a substitute for the OS gate. The plan suggested hashing in
native code; the JavaScript implementation was chosen because it is already
tested in a sibling project, runs under Jest, and the stretched record never
leaves the encrypted vault anyway. Moving it to the module remains an option
if profiling shows the JS thread stalls on low-end devices.

### Lockout

Every fifth consecutive failure locks the keypad for 30 s, doubling each time
up to an hour. The state is persisted in the vault so a relaunch does not
reset it, and it is a pure module with tests (`src/features/auth/lockout.ts`).

### Auto-lock and privacy

- `AppState` transitions record when the app left the foreground; on return
  the session locks if the idle time exceeds the setting (immediately, 1, 5,
  15 minutes, or never). The default is one minute.
- The privacy screen blurs the app while inactive and enables screen-capture
  prevention while unlocked. Both follow one setting so a user who turns it
  off gets neither surprise.
- An optional step-up asks for biometrics again before a decrypted file is
  handed to the share sheet.

### Android key access window

The Android Keystore key is created with a 300-second authentication validity
window rather than per-use authentication, because per-use keys require a
`CryptoObject` on every cipher call and the module encrypts files in chunks.
Auto-lock bounds how long an unlocked session can exercise the key.

## Consequences

- Cold starts, deep links, and background returns all pass through the same
  gate; there is no second code path to keep secure.
- Setup is three onboarding slides, a PIN, and one OS prompt. There is no
  "create vault" button.
- The PIN record, lockout state, and settings live inside the vault, so they
  are covered by the same key and by backups.
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
