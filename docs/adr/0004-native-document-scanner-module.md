# ADR 0004: Native document scanner as a local Expo module

- Status: Accepted
- Date: 2026-09-07

## Context

The prototype captured documents with the plain camera or the photo
library. Edges were not detected, pages were not straightened, and a
multi-page lease meant several separate documents. Both platforms ship a
document scanner: VisionKit's `VNDocumentCameraViewController` on iOS and
the ML Kit Document Scanner (`GmsDocumentScanning`) on Android, which
downloads its models through Google Play services.

Third-party wrappers exist, but each bundles its own native code, lags the
platform SDKs, and would be the only dependency in the project that is not
either a platform framework or an Expo package.

## Decision

`modules/expo-document-scanner` is a local Expo module with one Swift file
and one Kotlin file. It exposes

```ts
isScannerSupported(): boolean;
scanDocuments(options?: { quality?: number; maxPages?: number }): Promise<ScannedPage[]>;
```

where each page is a perspective-corrected JPEG in a temporary file with its
size. Cancelling resolves with an empty array; the caller never sees a
rejection for a user choice.

The JavaScript side loads the native module optionally and treats a missing
module as "unsupported". This keeps a development client that predates the
module running, and it is what makes the simulator path work: VisionKit
reports the document camera as unsupported there, so the add flow shows
"Take a photo" with the plain camera instead of a dead button.

The add flow copies each page into the vault immediately after the promise
resolves; temporary files are not trusted to survive.

## Consequences

- Multi-page capture, edge detection, and straightening come from the
  platform, with no third-party native dependency.
- The scanner UI differs per platform. That is accepted: users know their
  own platform's scanner from Notes and Files or Drive.
- Android needs Google Play services. Devices without it fall back to the
  camera through the same `isScannerSupported()` check.
- The Android module inherits the simulator patching from ADR 0001 because
  ML Kit's frameworks are shared.
- Jest uses `src/index.mock.ts`, which reports the scanner as unsupported,
  so screens render in tests without native code.

## Alternatives considered

- `react-native-document-scanner-plugin` or similar: rejected for the
  dependency reasons above and because they expose fewer options than the
  platform APIs.
- Manual edge detection over `expo-camera` frames: far more code for a
  worse result than either platform scanner.
