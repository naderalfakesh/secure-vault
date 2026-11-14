# On-device language models for document suggestions

> Verified: 2026-11-14 (host: `npm run validate`; Release builds on the iOS
> 27.2 simulator and on the Pixel 9; neither model produced a suggestion in
> these runs, see "Device runs")
>
> Base: `main` at `30e2859`. Decision: [ADR 0008](../adr/0008-on-device-language-models.md).

## What changed

- `modules/expo-document-ai`, a third local Expo Module:
  - iOS: Apple Foundation Models with guided generation (`@Generable`,
    category limited with `.anyOf`, greedy sampling). `FoundationModels` is
    weakly linked, so iOS 16.4 to 25 still run. The simulator answers
    `unavailable` (reason `simulator`).
  - Android: Gemini Nano through ML Kit's GenAI Prompt API, temperature 0,
    top-k 1, 256 output tokens. Pinned to `1.0.0-beta4`: `beta5` is built
    with Kotlin 2.4 and the Expo SDK 58 compiler is Kotlin 2.2. The library
    needs API 26; the module overrides its minimum and only loads the Gemini
    classes from API 26, so the app's API 24 floor stays.
  - `modelInfo()`, `extractDetails(instructions, text)` and, Android only,
    `downloadModel()`.
- `src/features/intelligence/onDeviceModel.ts`: one set of instructions for
  both platforms, then `checkModelAnswer` keeps only what the text supports
  (dates the text contains, numbers that appear in it and hold a digit, the
  app's own categories, short titles, clean tags). The heuristic fills what
  the model left out; any failure, a non-JSON answer or 20 seconds without
  one falls back to the heuristic for the whole document.
- Settings names the engine ("Apple Intelligence" or "Gemini Nano, on this
  device. Every guess is checked against the text."), says when the model is
  not on the phone yet or still downloading, and offers Download for a
  downloadable Gemini Nano. Only that tap starts a download.
- The last design-handover citations ("(F13)", "J0" and the like) were
  removed from 24 files.

## Checks

| Check                                        | Result                                                               |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `npm run validate`                           | Green: 92 suites, 905 tests, Expo Doctor 20/20                       |
| Intelligence tests (`onDeviceModel.test.ts`) | 12 new cases: checks, merge, fallbacks, timeout, selection, download |
| iOS Release build (simulator)                | `BUILD SUCCEEDED` after `pod install`                                |
| Android `assembleRelease` (arm64)            | `BUILD SUCCESSFUL` with `genai-prompt` `1.0.0-beta4`                 |

## Device runs

| Run                                   | Result                                                                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS 27.2 simulator, first build       | `SystemLanguageModel` reported available. Importing the sample insurance card called the model; the log shows `InferenceError::operationNotAllowed::Simulator is not supported`. The form showed the heuristic's suggestions and no error: the fallback works |
| iOS 27.2 simulator, after the fix     | Settings reads "Text patterns read on this device."                                                                                                                                                                                                           |
| Pixel 9 (Android 17), AICore 26.10.15 | `checkStatus()` returned `1` (`DOWNLOADABLE`). Settings read "Text patterns read on this device. Gemini Nano is not on this phone yet." The owner chose not to download the model, so no Gemini Nano answer was seen                                          |

## Owed

- A Foundation Models answer on a physical iPhone with Apple Intelligence on
  (iOS 26 or later).
- A Gemini Nano answer on the Pixel 9 after its Download, and the Download
  row itself: the build with it compiles and its logic is covered in Jest,
  but it was not installed on the phone in this run.
- On both, the sample documents from `scripts/demo/make-sample-documents.swift`
  imported once with the model and once without, to compare the suggestions.
