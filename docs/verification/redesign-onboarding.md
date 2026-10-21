# Redesign step 6: onboarding, biometrics, vault unavailable

Branch `feat/redesign-onboarding`, from `qa/milestone1` 27419d3 (main with SDK
58 and the polish pass, T7b, and the redesigned core screens). Scope is
handover §9 step 6: J0 onboarding with the biometrics step, the Vault
unavailable status (F1 / SV-G1), the biometric availability detail (F13),
and the protection page (§7.6).

## Gate status

| Gate                          | Status                              | Effect here                                                                    |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| SV-G1 (`unavailable` status)  | Implemented on this branch          | The launch derivation in `SessionProvider` changes here, with tests.           |
| T4 (protection page, intro 2) | Satisfied (claims fix merged)       | Intro step 2 and "How your data is protected" are in.                          |
| G6 (restore hardening)        | Native QA of the base still running | Do not merge before the base's QA is recorded.                                 |
| G11 (one restore entry)       | Unchanged                           | Settings still has exactly one restore row; `settings-screen.test.tsx` checks. |

No crypto, key, backup-format or schema change. Settings JSON gains one
field, `biometricUnlock` (default on, so upgrades keep today's behaviour).

## Status model

`SessionStatus` is `loading | unavailable | setup | locked | unlocked`.

Launch (and Try again) reads the key presence (`vault.hasVault`: resolves
present or absent, a rejection is unreadable) and the PIN record
(`sessionStorage.readPinRecord`: present, absent, or unreadable when the
secure store throws), plus the lockout and the entry listing as before.

| Key        | PIN               | Status              |
| ---------- | ----------------- | ------------------- |
| unreadable | any               | `unavailable`       |
| any        | unreadable        | `unavailable`       |
| present    | present           | `locked`            |
| present    | absent            | `setup` (Add a PIN) |
| absent     | absent or present | `setup` (intro)     |

Transitions:

- `unavailable` → re-read on Try again, and once on every return to the
  foreground → whatever the table says. Nothing is written meanwhile (the
  lockout cap write-back from N5 stays as before).
- `setup` → `setUp` reads key and PIN again first: unreadable → `unavailable`
  with nothing created; key + PIN + entries (or a failed listing) → `locked`
  with the PIN untouched; key + PIN + no entries (an erase whose PIN delete
  failed) → setup replaces the PIN; a key that appeared since launch is kept.
- `setup` with `holdForOnboarding` → stays `setup` with `setupHeld` until
  `finishSetup()` → `unlocked`. Only first run and the emptied vault hold, and
  only when biometrics are available, so the held window guards no documents.
- `unlocked` → `setup` on erase (the M1 `exclusive('erase')` hold in Settings
  is unchanged; `eraseVault` also drops a held setup).
- An unreadable PIN record during unlock is `not-unlocked` with "Your PIN
  could not be read right now. Try again." and does not count towards the
  N5 lockout; in Change PIN it is `failed`.

`app/unavailable.tsx` is its own `Stack.Protected` group at `/unavailable`;
no other guarded screen shares its URL. The lock routes and guards are
unchanged. Security checks still only warn.

## What is done

- **Vault unavailable**: §7.2 copy, header role on the title, Try again with
  the busy label "Trying again…" (`accessibilityState.busy`, announced on
  iOS, polite live region), the only control on the screen.
- **Intro 1–3**: §7.5 copy; step 2 names the iOS Keychain or Android
  Keystore; step 3 names the biometric (Face ID, Touch ID, fingerprint or
  face, or the device passcode / screen lock without one); Skip on steps 1–2,
  Back on 2–3, "Step n of 3". Reduced motion shows one step at a time with no
  slide.
- **Choose PIN**: "Step 1 of 2" / "Step 2 of 2", "Your backup way in when
  Face ID isn’t available.", the mismatch copy "The PINs didn’t match. Start
  again." (back to step 1, nothing saved), "Creating your vault key", and
  the soft warning "This PIN is easy to guess." for repeated digits and
  straight runs with "Use it anyway" / "Choose another". The emptied-vault
  copy from the polish pass is kept.
- **Add a PIN**: a key that guards entries goes straight to the PIN screen
  (no intro, no Back, no step label, no biometrics step); the key is kept.
- **Biometrics step** (`app/setup/biometrics.tsx`): shown only when
  biometrics are available; "Use Face ID" runs a biometric-only
  `authenticateAsync`, then opens the vault whatever the answer; "Not now"
  turns biometric unlock off. Reached only from a held setup; Android back
  is consumed.
- **F13** (`src/features/auth/biometricAvailability.ts`): available, not
  enrolled, denied (iOS only: the hardware type is reported while biometrics
  are "not available"), unavailable.
- **Settings**: a Face ID / biometric unlock switch; disabled with the
  reason when not set up, or when SecureVault is not allowed, plus an Open
  Settings row; hidden without hardware. The lock screen reads the setting at
  launch and, when it is off, does not auto-prompt and hides the biometric
  key.
- **How your data is protected** (`app/settings/protection.tsx`), behind the
  unlock gate.

## Deviations from the copy deck, and why

- §7.6 fact 1 said the index is encrypted with AES-256-GCM. The index is
  SQLCipher with its own key kept in the vault (SECURITY.md "Database key"),
  so the sentence says that instead.
- Two limits were added, both from SECURITY.md: a jailbroken, rooted or
  tampered OS, and the short-lived decrypted cache copies.

## Deferred

- Intro illustrations (paper stacks) are icon badges; the dark-board phones
  are only the dark theme.
- A cross-fade for reduced motion: Reanimated skips layout animations under
  the system setting, so a plain swap is what would show anyway.
- With biometric unlock off, the iOS Keychain's own `userPresence` gate can
  still show Face ID after a correct PIN, and "Use Face ID or passcode" stays.
  That is the device key's gate, not a bypass; changing it is native work.
- The pending (held) setup is not judged by auto-lock; it guards an empty vault.

## Tests

- `SessionProvider.unavailable.test.tsx`: unreadable key at launch (with and
  without a vault), unreadable PIN with and without a key, transient failure
  then Try again, still failing with no writes, foreground re-run, unreadable
  PIN at unlock not counted, the setUp re-checks (key fails, PIN fails, key
  appeared, key + PIN → locked, emptied vault replaces a stale PIN), held setup.
- `vault-unavailable.test.tsx`: the real router shows the screen instead of
  setup, URLs cannot reach setup or the vault, busy label, retry to lock.
- `onboarding.test.tsx`: intro → PIN → biometrics (Not now, Use Face ID,
  refused), skipped when not enrolled, Skip, easy PIN both ways, mismatch,
  Add a PIN, biometrics step unreachable before a PIN.
- `biometricAvailability.test.ts`, `onboardingCopy.test.ts`,
  `protection-screen.test.tsx`, Settings Face ID row and protection link,
  lock screen with biometric unlock off, the protection page behind the gate.
- `npm run validate`: exit 0 (66 suites, 476 tests, expo-doctor 20/20). The
  "worker failed to exit gracefully" warning is already on the base.

## Native QA owed (not run here)

`expo-local-authentication` is a new native module: prebuild and rebuild
both platforms. Not run: simulator, emulator, physical devices.

1. First run on iOS and Android: intro (Skip, Back, swipe, VoiceOver/TalkBack
   "Step n of 3"), Choose PIN, easy PIN warning, mismatch, Creating your
   vault key, biometrics step, empty Library.
2. iOS Face ID permission: deny it at the first prompt; Settings shows "not
   allowed" with Open Settings; allow it there and return; the row enables.
3. Not enrolled (simulator with Face ID off / emulator without a
   fingerprint): no biometrics step; Settings shows the reason.
4. Not now, relaunch: lock screen asks for the PIN, no auto-prompt.
5. Add a PIN: install-over a vault with a key and no PIN record.
6. Delete everything → setup with the emptied-vault copy → biometrics step.
7. Vault unavailable: force a PIN record read failure (iOS launch before
   first unlock, or a debug hook), check the screen, VoiceOver header and
   busy announcement, Try again, and the re-run on foreground return.
8. Large text (AX5) on the unavailable screen, the intro and the protection
   page; RTL layout of the intro bar and the PIN header.

## Review fixes (approved review, Lows)

- L1: the biometrics step saves `biometricUnlock` from the prompt's
  `success`; cancelling it ("Not now" in the prompt) turns it off.
- L2: on Android, availability needs strong (class 3) biometrics, the only
  kind the vault key accepts; weak face unlock alone hides the step and row.
- L4: a phone without a passcode or screen lock gets `noPasscode` and its own
  sentence instead of "isn't set up".
- L3: SECURITY.md says auto-lock does not time the biometrics step, which
  only runs on an empty vault.
- I4: a held setup killed before it finishes relaunches to `locked` (test).
- Native QA adds: an Android phone with only class-2 face unlock, and an iOS
  simulator or device with no passcode set.
