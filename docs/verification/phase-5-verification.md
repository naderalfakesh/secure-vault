# Phase 5 verification

> Verified: 2026-09-07
>
> Scope: native document scanner module, Photos and Files as secondary
> sources, processing overlay with per-step progress

## Outcome

`modules/expo-document-scanner` wraps VisionKit's document camera on iOS and
the ML Kit Document Scanner on Android behind one call,
`scanDocuments(): Promise<ScannedPage[]>`, with multi-page results. The add
flow offers the scanner first when `isScannerSupported()` is true and falls
back to the plain camera otherwise. [ADR 0004](../adr/0004-native-document-scanner-module.md)
records the choice.

## Native run evidence

Android, Medium Phone emulator, API 36.1:

1. Add a document lists "Scan with the camera" first, then Photos and Files.
2. Scan with the camera opens the ML Kit scanner over the emulator's
   virtual scene. It detects and auto-captures a page, then shows its own
   Preview with Crop & Rotate, Filter, Retake, and Delete
   (`docs/images/scanner-android.png`).
3. Done returns the page to the app: the Details form appears with the
   title "Scanned document", and Save to vault lands on Home with one
   document and its thumbnail.
4. Choose from Photos opens the system photo picker limited to the selected
   items. Picking the seeded passport image returns to Details with the text
   already read; Save lands on Home with two documents. The vault stayed
   unlocked behind the picker, which is the auto-lock suspension around
   system UI from Phase 4.

iOS, iPhone 17 Pro simulator:

1. VisionKit reports the document camera as unsupported on simulators, so
   `isScannerSupported()` is false and the first source reads "Take a
   photo" with the plain camera instead. The scanner itself needs a
   physical iPhone and was not exercised in this pass.
2. Choose from Photos with the seeded passport image: the picker closes,
   Details shows the text-derived suggestions, Save lands on Home
   (`docs/images/add-suggestions-ios.png`, `home-expiring-ios.png`).

## Processing overlay

The overlay lists Reading the text, Suggesting details, Encrypting, and
Indexing, with the active step spinning and finished steps ticked. It is
drawn inside the screen rather than as a native modal (see the Phase 4 note
for why). On the synthetic passport the OCR and suggestion steps finish in
well under a second on both platforms, so the overlay is only visible on
larger scans.

## Quality gate

`npm run validate` passes. The scanner module ships a Jest mock so the add
screen renders in tests without native code.

## Deferred

- Scanner on a physical iPhone.
- Import a file with a PDF was not exercised in this pass; PDF rendering is
  Phase 7 work.
- The overlay is not cancellable yet.
