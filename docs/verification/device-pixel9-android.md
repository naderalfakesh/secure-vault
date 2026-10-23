# Pixel 9 Android device verification

> Verified: 2026-10-23 (Android only; iPhone testing deferred by the owner)
>
> Scope: the Android items of the [device handoff checklist](device-handoff.md)
> on a physical phone, the findings it turned up, and their fixes.

## Setup

- Device: Google Pixel 9, Android 17.
- Build: release APK, R8 on, JS bundle embedded, signed with the template's
  debug key. First run on APK `0835eddd…`; the final APK is
  `SecureVault-1.0.0-1-release-71e7463.apk` (sha256 `ab7e1be8…`) for `main`
  at `71e7463`.
- Driven over wireless adb. The owner did the fingerprint, face, camera and
  permission taps.

## Findings and fixes

Every fix below was checked on the phone with the final APK.

| ID  | Severity | Finding                                                                                                                                                                                    | Fix       |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| H1  | High     | Camera scan failed at once with a `NullPointerException`, and text reading on imports returned nothing: R8 removed the ML Kit registrar constructors (see [release-prep](release-prep.md)) | `def77d7` |
| F7  | Medium   | Horizontal swipe between pages in the viewer did nothing                                                                                                                                   | `550c71c` |
| —   | Copy     | "Wrong PIN. N attempts left before a pause." named the pause                                                                                                                               | `bc04c80` |
| F6  | Medium   | Backup had no Save to device on Android, only the share sheet                                                                                                                              | `bd5013d` |
| F5  | Medium   | Scanner failure showed raw Java text instead of a sentence                                                                                                                                 | `b67d232` |
| F2  | Low      | A password-protected PDF was refused as if it were not a PDF                                                                                                                               | `ebc55e1` |
| F3  | Low      | A photo from the system picker got its media id (`7233`) as title                                                                                                                          | `36c9498` |
| F4  | Low      | Tapping a settings switch row's label did not toggle it                                                                                                                                    | `32aec09` |
| F8  | Low      | The share warning showed a scanned document as `0 B`                                                                                                                                       | `3dd112c` |

Review of the fix batch (M1 and follow-ups): `f75c5b5` never shows native
rejection text from a failed vault call, `438edc0` drops the zoom state when
the viewer swaps a zoomed page, and `98529be` notes in `docs/SECURITY.md`
the partial file a killed Save to device can leave.

Open notes, no fix:

- With auto-lock Immediately, opening Recents and going straight back does
  not lock (the cover shows in Recents).
- The lock and onboarding screens are not `FLAG_SECURE`, so system
  screenshots work there; the Library is protected.

## Checklist results

`iOS` means the item needs the iPhone, which is deferred. "No result" means
the session notes record no outcome for the item.

| Item | Result         | Note                                                                             |
| ---- | -------------- | -------------------------------------------------------------------------------- |
| 1.1  | PASS           | Onboarding through to the Library                                                |
| 1.2  | PASS           | Wrong-PIN copy changed in `bc04c80`                                              |
| 1.3  | No result      |                                                                                  |
| 1.4  | NOT TESTED     | Resetting the PIN or restoring to check it wipes the vault                       |
| 1.5  | PASS           | Pause, longer second pause, relaunch keeps the pause                             |
| 1.6  | Note           | Recents and back with Immediately does not lock (above)                          |
| 1.7  | PASS           | Library and an open sheet covered in Recents                                     |
| 1.8  | iOS            |                                                                                  |
| 1.9  | iOS            |                                                                                  |
| 2.1  | iOS            |                                                                                  |
| 2.2  | PASS after fix | H1 (`def77d7`), F5 (`b67d232`)                                                   |
| 2.3  | No result      |                                                                                  |
| 2.4  | PASS after fix | F3 (`36c9498`)                                                                   |
| 2.5  | PASS after fix | F2 (`ebc55e1`)                                                                   |
| 2.6  | No result      |                                                                                  |
| 2.7  | No result      |                                                                                  |
| 2.8  | PASS after fix | Before `def77d7` search found titles only                                        |
| 3.1  | PASS           | Undo after delete (owner)                                                        |
| 3.2  | PASS after fix | F7 (`550c71c`, `438edc0`); pinch zoom, swipe down to close and page strip passed |
| 3.3  | No result      |                                                                                  |
| 3.4  | PASS after fix | F8 (`3dd112c`)                                                                   |
| 3.5  | iOS            |                                                                                  |
| 3.6  | PASS           | Chooser cases, banner and Share again                                            |
| 3.7  | No result      |                                                                                  |
| 4.1  | PASS after fix | F6 Save to device (`bd5013d`)                                                    |
| 4.2  | PASS           | Restore brought back all 5 documents                                             |
| 4.3  | iOS            |                                                                                  |
| 4.4  | iOS            |                                                                                  |
| 4.5  | No result      | Needs a backup of hundreds of MB                                                 |
| 4.6  | PASS           | Wrong passphrase, both ways                                                      |
| 4.7  | No result      |                                                                                  |
| 4.8  | NOT TESTED     | The 1.4 MB test backup restores in under a second, too fast to lock during it    |
| 4.9  | iOS            |                                                                                  |
| 5.1  | NOT TESTED     | Would change the owner's screen lock                                             |
| 5.2  | NOT TESTED     | Would change the owner's screen lock                                             |
| 5.3  | NOT TESTED     | Would change the owner's screen lock                                             |
| 5.4  | iOS            |                                                                                  |
| 5.5  | No result      |                                                                                  |
| 5.6  | NOT TESTED     | Wipes the vault                                                                  |
| 6.1  | PASS           | Library loads and search works in the release APK                                |
| 6.2  | PASS           | Encrypt, decrypt, backup and restore in the release APK                          |
| 6.3  | iOS            |                                                                                  |
| 6.4  | PASS           | Version shown, no dev tools                                                      |
| 7.1  | iOS            |                                                                                  |
| 7.2  | NOT TESTED     | TalkBack skipped by the owner                                                    |
| 7.3  | No result      |                                                                                  |
| 7.4  | No result      |                                                                                  |
| 7.5  | No result      |                                                                                  |
| 8.1  | No result      | Optional                                                                         |
| 9.1  | iOS            |                                                                                  |
| 9.2  | PASS           | Adaptive icon, no halo (owner)                                                   |

## Still open

- The whole iPhone pass (every `iOS` item above), deferred by the owner.
- Android: TalkBack, 4.8 with a larger backup, 1.4, 5.1–5.3 and 5.6 on a
  phone whose vault and screen lock may be changed, and the "No result" items.
