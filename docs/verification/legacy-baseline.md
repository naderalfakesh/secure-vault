# Legacy SecureVault baseline

> Recorded: 2026-09-07
>
> Annotated tag: `legacy-v1` at `98f4303`
>
> Runtime: Expo SDK 53, React Native 0.79.6, React 19.0, TypeScript 5.8

This note closes the Phase 0 baseline before the platform upgrade. It records
what the 2025 prototype was, what was cleaned up, and what could be proven on
the current toolchain.

## What the tag contains

The tag points at the cleaned-up prototype, not the raw working tree that was
found on 2026-09-07. Seven uncommitted files and one untracked hook were
reviewed first:

| Change | Decision |
| --- | --- |
| Device integrity checks (`src/security`, `useSecurityStatus`) | Kept as an advisory banner. The config-hash check and the rule that treated `__DEV__` as tampering were dropped, because they blocked development builds and any config edit. |
| Lock screen blocked unlock when checks failed | Dropped. Rooted or modified devices get a warning, never a locked door. |
| iOS unlock accepts the device passcode (`.deviceOwnerAuthentication`, `.userPresence`) | Kept. It matches the Android `DEVICE_CREDENTIAL` fallback and makes the simulator usable. Biometric-bound key access returns in the vault module rework. |
| Import timeout for `content://` URIs, trimmed error logging | Kept. |
| "Test Authentication" row in Settings | Dropped. The plan lists it as one of the exposed scary parts. |

Identity was unified in one commit: display name **SecureVault**, slug
`secure-vault`, scheme `securevault`, bundle id and package
`com.naderalfakesh.securevault`, Keychain service
`com.naderalfakesh.securevault.vault`, and usage strings that talk about
documents instead of notes. The Keychain service rename invalidates any key
from earlier prototype installs; the prototype had no users.

Housekeeping: backup icon files removed, the `rnsec` scan reports moved out of
the root and ignored, the 2025 milestone plan archived under
`docs/legacy-project-plan.md`, Yarn replaced by npm with Node 24 pinned, and
the GitHub repository renamed from `cryptoNoteVault` to `secure-vault`.

## What was proven

- `npm install` resolves the SDK 53 dependency graph on Node 24.13.
- `tsc --noEmit` passes after one fix: the code already depended on the SDK 54
  `expo-file-system` package and read a removed `cacheDirectory` constant.
- `npx expo prebuild --clean --platform ios` and `pod install` succeed.

## What could not be proven

The iOS app does not compile on Xcode 26.6. React Native 0.79 pins the
`fmt` 11.0.2 pod, whose `consteval` format strings are rejected by the current
clang, so `xcodebuild` fails before any SecureVault source is reached. Expo CLI
also fails earlier with "Unable to find a destination", because the generated
SDK 53 project exposes no concrete simulator destinations to Xcode 26.6.

Both problems are fixed upstream in React Native 0.81 (Expo SDK 54), which is
the first upgrade step. Patching a legacy toolchain to produce screenshots of
the prototype would not change the plan, so the tag, the typecheck, and the
source are the historical evidence. No Android build was attempted for the
baseline for the same reason.

There are no tests, lint configuration, or CI at this tag.
