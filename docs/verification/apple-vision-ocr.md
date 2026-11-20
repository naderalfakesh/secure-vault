# Apple Vision text recognition on iOS

> Verified: 2026-11-20 (iOS simulator run; Android checked by tests and
> autolinking, no device run)
>
> Scope: [ADR 0011](../adr/0011-apple-vision-text-recognition-on-ios.md).
> iOS reads document text with Apple Vision instead of Google ML Kit, the
> iOS build drops the ML Kit pods and the simulator patch from ADR 0001, and
> the privacy copy follows the platform. Android keeps ML Kit.

## What changed

| Area         | Change                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native (iOS) | `modules/expo-document-ai/ios/TextRecognizer.swift`: `VNRecognizeTextRequest`, `.accurate`, language correction and automatic language detection, EXIF orientation; `recognizeText(path)` on the module |
| JS module    | `recognizeText` in `modules/expo-document-ai/src/index.ts` (rejects off iOS), with a Jest double (`setRecognizedText`, `recognizedPaths`)                                                               |
| OCR service  | `src/services/ocr/`: `readWithVision` (iOS), `readWithMlKit` (Android), `groupLines` turns Vision's lines into ML Kit-shaped blocks; `@/services/OcrService` keeps its path and shape                   |
| iOS build    | `react-native.config.js` unlinks `@react-native-ml-kit/text-recognition` on iOS only; `plugins/withMlkitSimulatorFix.js` and `plugins/mlkit-sim-patch.py` removed                                       |
| Copy         | iOS: a checked fact "SecureVault reads document text on this phone with Apple's Vision framework…" and a processing footer naming Vision. Android: the ML Kit notice and footer as before               |
| Docs         | ADR 0011 (new), ADR 0001 marked superseded, `docs/SECURITY.md`, README, CLAUDE.md, plan OCR row                                                                                                         |

## Quality gate

Run from the worktree (`.claude/worktrees/…`). `jest.config.js` ignores
`/.claude/` so agent worktrees do not run each other's tests, which also
hides every test inside a worktree; Jest was run with the same ignore list
minus that entry.

| Check                                                                     | Result                           |
| ------------------------------------------------------------------------- | -------------------------------- |
| `npm run format:check`                                                    | Pass                             |
| `npm run lint`                                                            | Pass                             |
| `npm run typecheck`                                                       | Pass                             |
| `npx jest --testPathIgnorePatterns /node_modules/ /ios/ /android/ /dist/` | 119 suites, 1065 tests, all pass |
| `npx expo-doctor`                                                         | 20/20 checks pass                |

New tests:

- `src/services/ocr/__tests__/OcrService.test.ts`: on iOS the service calls
  Vision with a `file://` URI, never ML Kit, and returns grouped blocks; on
  Android it calls ML Kit, never Vision, with the same mapping as before; a
  failure on either returns an empty result so the import goes on.
- `src/services/ocr/__tests__/blocks.test.ts`: labels stay with the value
  under them, columns stay apart, gaps start a new block, reading order,
  blank lines, bounding boxes.
- `src/__tests__/protection-screen.test.tsx`: iOS shows the Vision fact, no
  "ML Kit", "Google" or "Play services" text and no info notice; Android
  shows the ML Kit notice with its info icon.
- `src/features/scan/__tests__/components.test.ts`: the processing footer
  per platform; `scan-flow.test.tsx` checks the iOS footer in the flow.

## iOS build

`npx expo prebuild --clean --platform ios` (with `LANG=en_US.UTF-8`), then
`xcodebuild -workspace ios/SecureVault.xcworkspace -scheme SecureVault
-configuration Debug -sdk iphonesimulator` for the shared iPhone 18 Pro:
**BUILD SUCCEEDED**, straight from the spaced SSD path, with no
`post_integrate` patch in the Podfile.

- `ios/Podfile.lock` has no `GoogleMLKit`, `MLKit*` or `MLImage` pod.
- `strings` over `SecureVault` and `SecureVault.debug.dylib` finds no
  `MLKit`, `MLKITx` or `Clearcut` symbol; `recognizeText` is in the dylib.
- `npx expo-modules-autolinking react-native-config --platform android`
  still lists `@react-native-ml-kit/text-recognition`; the iOS list does not.

## Simulator run (iPhone 18 Pro, iOS 27.2)

The build was installed over the existing app (data kept), Metro ran from
the worktree on port 8083, and the vault was unlocked with the test PIN.

The sample passport ("Republic of Example", ALEX SAMPLE, SPECIMEN) was no
longer in the simulator's Photos library, only in the vault. Its page was
taken from a full-resolution screenshot of the vault viewer (1206 px wide),
added back with `simctl addmedia`, and imported with Choose from Photos.
Save Image from the share sheet does not work for this: the app has no
add-only Photos permission (the log says `Missing
NSPhotoLibraryAddUsageDescription`), which is intended.

| Field      | Stored document (ML Kit, earlier) | Re-import (Apple Vision)        |
| ---------- | --------------------------------- | ------------------------------- |
| Collection | ID & Personal                     | ID & Personal                   |
| Expires    | 14 Nov 2031                       | 14 Nov 2031                     |
| Issued     | 15 Nov 2021                       | 15 Nov 2021                     |
| Number     | •••• 0000                         | •••• 0000                       |
| Title      | Republic of Example Passport      | Republic Of Example (suggested) |
| Tags       | id, 2021                          | id, 1990                        |

- The processing sheet reads "Text is read on this device by Apple's Vision
  framework, which is part of iOS."
  ([screenshot](../images/vision-processing-ios.png))
- The form suggested every field above
  ([screenshot](../images/vision-suggestions-ios.png)). The import was not
  saved, so the shared vault has no duplicate.
- The stored title has a lowercase "of" and "Passport", which the heuristic
  never produces, so it was most likely edited when it was saved; the
  suggestion itself is the heuristic's usual first-heading title.
- The tag year differs. Tags are the category and the first year in the
  text; Vision's reading order puts the date of birth (right column, higher
  row) before the issue date, where ML Kit's block order did not. Both are
  guesses the form shows for editing.

A second, synthetic data page (REPUBLIC OF EXAMPLE, JANE DOE, X1234567,
issued 12 MAR 2020, expires 12 MAR 2030, labels above values in two
columns) gave ID & Personal, Expires 12 Mar 2030, Issued 12 Mar 2020 and
No. •••• 4567.

On the Mac, the same request settings (a Swift script with
`VNRecognizeTextRequest`) read both pages line for line, the SPECIMEN
overlay and the machine-readable zone included; language correction did not
change the document numbers.

The protection page on iOS lists six checked facts, the last being
"SecureVault reads document text on this phone with Apple's Vision
framework, which is part of iOS. The text isn't sent anywhere.", and no ML
Kit notice ([screenshot](../images/vision-protection-ios.png)).

## Android

No Android native code changed: the removed plugin only edited the iOS
Podfile, `react-native.config.js` unlinks ML Kit for iOS only, and the
Android reader is the earlier mapping moved into `readWithMlKit`, covered by
the Android tests above. No emulator or Pixel run was made for this change.

## Not covered

- A physical iPhone and a Release build or archive (the ADR 0001 question
  about patched objects no longer applies, but Vision on a device was not
  run).
- Network capture on iOS to show no Google host is contacted; the binary
  check above is the evidence instead.
- The two sample images added to the shared simulator's Photos library
  (about 200 KB each) were left there.
