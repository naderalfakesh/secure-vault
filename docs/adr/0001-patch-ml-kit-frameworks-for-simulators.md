# ADR 0001: Patch Google ML Kit frameworks for Apple Silicon simulators

- Status: Accepted
- Date: 2026-09-07

## Context

SecureVault runs on-device OCR through `@react-native-ml-kit/text-recognition`,
which depends on Google's `GoogleMLKit/TextRecognition` pods. Google ships
those frameworks as fat static binaries with device `arm64` and simulator
`x86_64` slices only, and every ML Kit podspec sets
`EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64` on the app target.

Xcode 26 removed the ability to run x86_64 simulator apps under Rosetta. With
`arm64` excluded, no simulator on an Apple Silicon Mac is an eligible run
destination, `xcodebuild` reports "Unable to find a destination", and
`expo run:ios` cannot install anything. This is why the 2025 prototype was
never usable on a simulator and why the first Phase 1 build attempts failed on
every Expo SDK.

## Decision

Keep ML Kit for now and make the generated iOS project build for arm64
simulators through a config plugin, `plugins/withMlkitSimulatorFix.js`, which
injects a CocoaPods `post_integrate` hook that:

1. removes the `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64` line from every
   generated xcconfig, including the aggregate `Pods-SecureVault` files that
   CocoaPods writes after `post_install`;
2. runs `plugins/mlkit-sim-patch.py` over every `MLKit*` and `MLImage`
   framework binary, deleting the `LC_BUILD_VERSION` load command from the
   arm64 objects so the linker treats them as platform-agnostic and accepts
   them for the simulator as well as the device.

The plugin is the same approach Nadir Wallet uses for its ML Kit face-liveness
and barcode plugins, generalized to patch all ML Kit frameworks present.

## Consequences

- Development builds run on the iPhone simulators the team actually has, with
  OCR working; the SDK 54 verification run recognized text on a library photo.
- Device builds are unaffected: the patch only touches arm64 objects that were
  already device objects, and the exclusion line only ever applied to the
  simulator SDK.
- The patch runs on every `pod install`, so a clean prebuild needs Python 3 on
  the PATH. CI does not build native projects, so it is not affected.
- The fix is a workaround for Google's packaging, not a fix for it. Newer ML
  Kit releases (checked up to `MLKitCommon` 14.0.0) still ship the same
  exclusion, so upgrading does not remove the need.

## Alternatives considered

- **Run the simulator under Rosetta.** No longer possible on Xcode 26.
- **Test OCR only on physical devices.** Blocks the whole app on simulators,
  not just OCR, because the exclusion applies to the app target.
- **Replace ML Kit on iOS with Apple's Vision framework.** The strongest long
  term option: `VNRecognizeTextRequest` is on-device, needs no third-party
  frameworks, and would let the vault module own OCR on iOS. It is deferred to
  the scanning and intelligence phases, where the OCR pipeline is redesigned
  anyway. If that lands, this plugin becomes Android-irrelevant and can be
  removed together with the iOS ML Kit dependency.
