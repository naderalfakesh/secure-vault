# ADR 0008: On-device language models for document suggestions

- Status: Accepted
- Date: 2026-11-14
- Builds on: [ADR 0005](0005-document-intelligence-adapter.md)

## Context

ADR 0005 put document suggestions behind an adapter and shipped only the
heuristic engine. Its regular expressions miss what a reader sees at once:
the issuer of a card read column by column, which of three dates is the
expiry, a number whose label is two lines away. Both platforms now ship a
language model that runs on the device: Apple's Foundation Models framework
on iOS 26 and later with Apple Intelligence on, and Gemini Nano through
Android AICore, reached with ML Kit's GenAI Prompt API on supported phones
such as the Pixel 9. Nothing may leave the device, so cloud models stay out.

A language model can also be confidently wrong. It can produce a plausible
expiry date that is nowhere in the document, a passport number with one
digit changed, or a category the app does not have.

## Decision

A local Expo module, `modules/expo-document-ai`, exposes two calls on both
platforms:

- `modelInfo()`: which model this platform has and whether it can answer
  now (`available`, `downloadable`, `downloading`, `unavailable`).
- `extractDetails(instructions, text)`: the model's answer as JSON text.
- `downloadModel()`: asks AICore for Gemini Nano (Android only).

On iOS the module uses guided generation: a `@Generable` struct with
`@Guide` descriptions, the category limited to the app's seven values with
`.anyOf`, greedy sampling, and `FoundationModels` weakly linked so the app
still runs on iOS 16.4 to 25. On Android it sends one prompt with temperature
0 and top-k 1 and returns the model's text. ML Kit GenAI needs API 26 while
the app supports API 24, so the module overrides the library's minimum in its
manifest and only loads the Gemini classes from API 26 on.

The instructions live once, in TypeScript (`MODEL_INSTRUCTIONS`), and the
same TypeScript checks every answer against the document text before
anything reaches the form:

- a date must be ISO and one of the dates the text contains;
- a number must contain a digit and appear in the text, ignoring spaces,
  dashes, dots and slashes;
- the category must be one of the app's own;
- a title over 60 characters, or with JSON punctuation in it, is dropped;
- tags are cleaned, de-duplicated and capped at three.

What fails a check is dropped, and the heuristic engine fills the gaps. An
answer that is not JSON, a model error, or no answer within 20 seconds sends
the whole suggestion to the heuristic engine. The model is only picked when
it reports `available`. Settings names the engine in use ("Apple
Intelligence" or "Gemini Nano, on this device"), says when the model is not
on the phone yet or still downloading, and otherwise says that text patterns
are used.

AICore only downloads the Prompt API model when an app asks for it, so on
most Android phones Gemini Nano starts as `downloadable`. The app never
starts that download by itself: when the model is downloadable, the
Settings row offers Download, and only that tap calls `downloadModel()`.
Apple's model comes with Apple Intelligence, so iOS has nothing to start.

The simulator reports Apple's model as available and then refuses every
request, so on the simulator the module answers `unavailable` (reason
`simulator`) and Settings does not claim a model it cannot use.

## Consequences

- Phones with a model get better titles and categories; every other phone
  gets exactly what it had before.
- A wrong guess can still get through when the text contains it (the wrong
  one of two dates), but the model cannot add a value the document lacks,
  and the form still shows every guess for the owner to remove.
- The document text is untrusted input to the model. The instructions tell
  it to ignore instructions in the text, and the checks above bound what an
  injected instruction could achieve: at worst a wrong suggestion that the
  owner reviews.
- ML Kit GenAI is in beta; its API may change between releases, and AICore
  applies per-app quotas. The module pins `1.0.0-beta4`: `beta5` is built
  with Kotlin 2.4, which the Kotlin 2.2 compiler of Expo SDK 58 cannot read.
  Moving up waits for the SDK's Kotlin.
- The model calls are not covered by native unit tests: they need the model
  itself. The checks and fallbacks are covered in Jest with a double of the
  module, and the models are exercised in device runs.

## Alternatives considered

- Trusting the model's answer: rejected, for the reasons above.
- Structured output on Android (`GenerateTypedContentRequest`): not used
  yet; the text answer and the TypeScript checks keep one code path for both
  platforms. Worth revisiting when the API leaves beta.
- Starting the Gemini Nano download automatically: rejected. It is a system
  download of unknown size until it starts; it happens only on the owner's
  tap in Settings, and the heuristic covers every phone until then.
