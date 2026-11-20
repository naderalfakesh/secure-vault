# ADR 0011: Apple Vision text recognition on iOS

- Status: Accepted
- Date: 2026-11-20
- Supersedes: [ADR 0001](0001-patch-ml-kit-frameworks-for-simulators.md)
- Builds on: [ADR 0005](0005-document-intelligence-adapter.md)

## Context

SecureVault read document text with Google ML Kit
(`@react-native-ml-kit/text-recognition`) on both platforms. On iOS that had
two costs:

- **Privacy.** `MLKitCommon` carries its own Clearcut uploader and sends
  Google usage and performance metrics with a per-installation identifier.
  Nothing in ML Kit turns this off, so the "How your data is protected" page
  had to say so, next to a claim that SecureVault collects no analytics.
- **Build.** Google ships the ML Kit frameworks without an arm64 simulator
  slice, so ADR 0001 rewrote their Mach-O load commands on every
  `pod install` to make the app run on Apple Silicon simulators, a patch that
  touches the objects device builds link and was never proven on an archive.

ADR 0001 already named Apple's Vision framework as "the strongest long term
option". iOS has shipped `VNRecognizeTextRequest` since iOS 13; it runs on
the device with the system's models, and the app already depends on Apple
for scanning (VisionKit) and suggestions (Foundation Models).

## Decision

- iOS reads text with Vision: `VNRecognizeTextRequest` at the `accurate`
  level with language correction and automatic language detection, on the
  image's EXIF orientation. It lives in the existing document AI module as
  `recognizeText(path)` (`modules/expo-document-ai/ios/TextRecognizer.swift`)
  rather than a new module, because OCR is the first half of the same
  pipeline and the module already has its JS wrapper, Jest double and
  podspec.
- Vision answers one observation per line. The Swift side returns each line
  with its frame in the upright image's pixels; `groupLines`
  (`src/services/ocr/blocks.ts`) groups them into blocks the way ML Kit does
  (a label and the value under it together, columns apart, blocks in reading
  order). Keeping that in TypeScript makes it a pure, unit-tested function,
  and the suggestion engines get text in the same shape on both platforms.
- `OcrService` picks the reader by platform: `readWithVision` on iOS,
  `readWithMlKit` on Android. Its public shape (`extractText`, `OcrResult`,
  `OcrBlock`) is unchanged.
- Android keeps ML Kit. `react-native.config.js` unlinks
  `@react-native-ml-kit/text-recognition` on iOS only, so no ML Kit pod is
  installed there. With no ML Kit framework left on iOS, the simulator patch
  (`plugins/withMlkitSimulatorFix.js`, `plugins/mlkit-sim-patch.py`) is
  removed.
- The disclosure follows the code: on iOS the protection page states that
  Apple Vision reads the text and nothing is sent, as a fact with a success
  check; on Android the Google ML Kit notice stays as it was.

## Consequences

- iOS builds link no Google frameworks: no Clearcut uploader, no
  per-installation identifier, no `MLKitCommon` privacy manifest entries.
  `docs/SECURITY.md` says ML Kit metrics are Android only.
- `pod install` no longer needs Python 3 or patches third-party binaries,
  and the open question in ADR 0001 about patched objects in device builds
  and archives goes away.
- The two platforms now read text with different engines and can disagree on
  the same page. The block grouping and the heuristics are tested against
  both shapes, and the simulator run in
  `docs/verification/apple-vision-ocr.md` checks the sample passport end to
  end.
- Language correction can "fix" codes into words. Every field is a guess the
  form shows before saving and the user can remove, and the page image is
  stored as captured, so a wrong correction costs a suggestion, not data.
- Vision is part of iOS, so it updates with the OS rather than with the app;
  results can change after an iOS update without a release.

## Alternatives considered

- **Keep ML Kit on iOS.** Keeps one engine but also keeps the telemetry
  disclosure and the binary patch.
- **`RecognizeDocumentsRequest` (iOS 26 Swift-only Vision API).** It reports
  paragraphs and tables, but the app supports iOS 16.4 and would need
  `VNRecognizeTextRequest` as a fallback anyway; worth revisiting when the
  minimum version moves to 26.
- **A separate `expo-text-recognition` module.** Cleaner name, but another
  podspec, Gradle stub and Jest double for one function.
- **Grouping lines in Swift.** Works, but only the native tests could check
  it; the grouping is plain geometry and belongs where Jest can run it.
