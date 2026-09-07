# ADR 0005: Document intelligence behind an adapter, heuristic first

- Status: Accepted
- Date: 2026-09-07

## Context

Users should correct suggestions rather than type metadata. The plan asks
for a title, a category, tags, and typed fields such as an expiry date,
produced from the OCR text, with on-device language models (Apple
Foundation Models on iOS 26, Gemini Nano on supported Android) when they
exist and a heuristic everywhere else. Nothing may leave the device.

Neither model can be exercised on the development machine, and both have
narrow availability in the field. Building the add flow directly on one of
them would leave most devices without suggestions.

## Decision

`src/features/intelligence` defines

```ts
interface DocumentIntelligence {
  readonly engine: 'apple-foundation-models' | 'gemini-nano' | 'heuristic';
  isAvailable(): Promise<boolean>;
  suggest(ocrText: string): Promise<DocumentSuggestion>;
}
```

`selectIntelligence()` walks a preference-ordered list once per launch and
returns the first available engine; `suggestForText()` calls it and falls
back to the heuristic engine if the chosen one throws. The heuristic engine
is always available and never throws.

The heuristic engine finds dates in the common layouts (ISO, day-first
numeric, day-month-year with month names, and month-first with a comma),
scores categories by keyword hits, picks the first readable line as the
title (title-casing headings set in capitals), and extracts three fields:
`expires` (the date nearest an expiry keyword, else the latest future
date), `issued`, and `number`. Fields are stored in the `fields` table from
ADR 0002 and read back for the Home "Expiring soon" row and the detail
screen. Tags are the category and the first year seen.

Every suggestion carries its `engine`, and Settings shows which engine is in
use so the app does not imply a model that is not there.

## Consequences

- The add flow reads text, suggests, and shows the form with the guesses
  filled in; the user's edits win.
- A model adapter later is one file and one entry in the candidate list.
- Heuristics are wrong sometimes. The form calls them guesses, lets a tap
  remove any field, and never saves a field the user has not seen.
- OCR text must keep its line breaks for the title heuristic; `cleanText`
  now preserves them and leaves digits alone.

## Alternatives considered

- Cloud models: rejected outright; the vault's promise is that nothing
  leaves the phone.
- Shipping a small on-device model in the app: an extra download of tens of
  megabytes for a portfolio app, with quality not clearly better than the
  heuristic on structured documents. Left for a later phase behind the same
  interface.
