# Phase 6 verification

> Verified: 2026-09-07
>
> Scope: `DocumentIntelligence` adapter, heuristic engine, extracted fields,
> Home "Expiring soon" row, engine shown in Settings

## Outcome

Extracted text now turns into suggestions before the Details form appears:
a title, a category, tags, and typed fields for expiry, issue date, and
document number. The adapter interface in `src/features/intelligence` lets
an on-device language model replace the heuristic engine later without
touching the add flow. [ADR 0005](../adr/0005-document-intelligence-adapter.md)
records the shape and the honest limits.

## Native run evidence

The test document is a rendered "Republic of Example" passport page with a
number, an issue date of 12 MAR 2020, and an expiry of 12 NOV 2026, added to
each platform's photo library.

iOS, iPhone 17 Pro simulator:

1. Choosing the image reads the text and pre-fills Details: category
   ID & Personal, and under Found in the text the chips Expires 12 Nov 2026,
   Issued 12 Mar 2020, Number X1234567
   (`docs/images/add-suggestions-ios.png`). The title stayed on the file
   name in this run; see the defect below.
2. Save lands on Home with an Expiring soon row for the passport and the
   "Saved with searchable text" toast (`docs/images/home-expiring-ios.png`).
3. The detail screen lists the fields with the number masked as `•••••567`
   and an eye button to reveal it (`docs/images/detail-fields-ios.png`).

Android, Medium Phone emulator, API 36.1, after the OCR fix:

1. The same image yields the title "Republic Of Example", category
   ID & Personal, the three fields, and the tags `id, 2020`.
2. Home shows "Expiring soon: Republic Of Example, Expires Nov 12, 2026"
   above Recent.

## Defect found by the run

`OcrService.cleanText` collapsed every line break into a space, so the
title heuristic, which reads the first readable line, never found one and
the form kept the file name. The same cleaner rewrote `0` and `1` next to
letters, which would have corrupted document numbers such as `0A1B`. Both
are fixed in commit 68cf895 with unit tests; capitalised headings are now
title-cased.

## Quality gate

`npm run validate` passes. Heuristic tests cover date layouts, category
scoring, expiry and issue extraction, the future-date fallback, title
selection, and the empty case; OCR cleaning has its own tests.

## Deferred

- Apple Foundation Models and Gemini Nano adapters. The interface and the
  selection order are in place, but neither model can be verified on this
  machine, so Settings reports the heuristic engine honestly.
- Local notifications ahead of an expiry.
