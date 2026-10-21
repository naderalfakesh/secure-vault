# Redesign step 5: scan and import (J1), F12, F11

Branch `feat/redesign-scan`, from `feat/redesign-onboarding` ae59eaf (main,
T7b, the core screens and onboarding). Scope is handover §9 step 5: the J1
Scan and import flow, the review-pages step and processing cancel (F12), and
the search snippet and expiry sort as query-only changes (F11).

## Gate status

| Gate                    | Status                    | Effect here                                                   |
| ----------------------- | ------------------------- | ------------------------------------------------------------- |
| F9 (camera probe)       | On main (06abd83), reused | Camera rows disabled with the reason when there is no camera. |
| G6 (restore hardening)  | As on the base branch     | Redesign merges still wait for it; this branch is not merged. |
| G11 (one restore entry) | Unchanged                 | No backup or restore code is touched.                         |
| D9 (import size limit)  | Open (§12)                | No limit copy and no size check; `import.tooLarge` is unused. |

No crypto, key, backup-format or schema change. F11 adds queries only; the
schema is still v1.

## What is done

- **Sources** (`src/features/scan/SourceList.tsx`): Scan with the camera
  (hero), Take a photo, Choose from Photos, Import a file, and the §7.8
  footer. Without a camera both camera rows stay, disabled, with "This device
  has no camera"; with a camera but no platform scanner only Take a photo is
  offered. Photos uses the system picker and no longer asks for photo
  library access.
- **Camera denied**: a refused camera request (Take a photo, or the scanner
  on iOS, which now asks first) replaces the camera rows with the brass §7.8
  callout and "Open Settings" (`Linking.openSettings()`); Photos and Files
  stay usable. A refusal from an earlier session shows on open
  (`getCameraPermissionsAsync`, `canAskAgain` false), and coming back from
  Settings with access on hides it. No toast, no alert.
- **Import errors**: anything but a PDF or a JPEG, PNG or HEIC image, and a
  PDF whose first page cannot be rendered, show "‹name› can't be added.
  Choose a PDF or an image (JPEG, PNG, HEIC)." inline (name isolated), and
  the Files row becomes "Choose another file". The picked copy and iOS's
  Inbox copy are removed. Type comes from the reported MIME type, the
  extension only when none is reported.
- **Review pages** (`ReviewPages.tsx`, F12): after a scan, a 3-column grid
  with "N pages", Discard, Continue, a remove (×) per page, Add pages
  (re-opens the scanner, appends), and the hint. Touch and hold a page to
  pick it up, then Move earlier / Move later / Done. VoiceOver and TalkBack
  get "Move earlier", "Move later" and "Remove" as actions on each page
  ("Page n of N"). Removing the last page returns to the sources.
- **Processing** (`ProcessingPanel.tsx`, F12): Reading the text → Suggesting
  details → Encrypting → Saving to your vault, each row "done / in progress /
  not started", announced politely (iOS announcement, Android live region),
  with the §7.8 footer. Cancel is offered while reading; once encrypting
  starts it is gone and "This can't be stopped." is shown and announced. A
  failed save stays here inline (alert role) with Try again (pages kept) and
  Back to details. If only the found values failed after the files were
  saved, Try again repeats just that and Back to details is not offered, so
  there is never a second copy of the document.
- **Details** (`DetailsForm.tsx`): "New document", Back (to the pages for a
  scan, to the sources otherwise), page thumbnails, Title with the inline
  "Give the document a title." error (no toast), Collection with
  "· suggested" when the suggestion picked it, "Found in the text" chips with
  × (numbers masked "No. •••• 4821") and the guess hint, Tags, Save to vault.
- **Saved**: back to the Library with "Saved with searchable text" or "Saved
  to your vault" and View, as before.
- **F11**: `DocumentRepository.searchWithSnippets` uses FTS5
  `snippet(documents_fts, ocr_text, …)` with control-character markers,
  parsed into highlighted pieces; only page text gets a snippet, so a
  title-only match shows none. `list(category, order)` and the search sort
  newest, oldest, or by the `expires` date in `fields` (undated last, newest
  first). Title A–Z is still sorted in JS, because SQLite's collations only
  fold ASCII. The JS `findSnippet` and `sortDocuments` are gone. Tested on
  the betterSqlite adapter with real FTS5.

## How the residue rules carried over

The screen still owns every plaintext copy through `held` and `shown` refs,
now updated synchronously with the state so a cleanup in the same tick sees
the latest set.

| Path                                                       | Copies                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Save succeeds                                              | Service removes them after the vault has them (unchanged).                                                 |
| Save in flight, screen closes                              | Save owns them; removed when it settles if the screen is gone.                                             |
| Save fails, screen here                                    | Kept for Try again.                                                                                        |
| Lock during a save                                         | Outcome via `postNotice` (unchanged tests).                                                                |
| Vault locked before the save wrote                         | New: nothing is written, copies removed, "Could not save the document." posted.                            |
| Remove a page                                              | That copy at once.                                                                                         |
| Discard; Cancel while reading or Back from a photo or file | All copies and the PDF preview.                                                                            |
| Back to pages (scan)                                       | Kept; still on screen.                                                                                     |
| Screen closes or the gate removes it                       | All copies and the preview (review, reading and details tested).                                           |
| Late scanner, picker, photo, read results                  | Removed or dropped (Add pages after close, late OCR after Cancel or lock).                                 |
| Unsupported or unreadable import                           | Picked copy, Inbox copy, preview.                                                                          |
| Kill                                                       | Lock and launch sweeps unchanged (`ImagePicker`, scanner, `DocumentPicker`, `pages_*`, Inbox, scan pages). |

The save has no loop of its own; it checks the session after opening the
index, before the first write, the way deletes check between documents.

## Deviations and deferred

- Drag to reorder is not built; holding a page picks it up and the Move
  buttons place it. The design's drag gesture needs a sortable grid.
- The new Library row is not highlighted after a save.
- Collections show all seven chips instead of three and "More…".
- Text is read from the first page only, as before.
- Copy not in the deck, written here: the saving title "Saving the
  document", "Your pages are being encrypted and saved on this device."
  under "This can't be stopped.", "Back to details", the "Page n of N,
  moving" label.
- `.maestro/first-document.yaml` was already out of date on the base.

## Review fixes (approved review, Lows)

- A save whose pages or index row fail part way is rolled back (row and
  vault entries), so Try again makes one document.
- One source at a time: a second tap while a pick is settling (a large PDF
  rendering) is ignored, and replacing a pick always removes the old copies.
- Files saved but found values failing: "Open document" closes the flow and
  opens the viewer (copy written here; the deck has none).
- A generic binary type (`application/octet-stream`) defers to the
  extension, and the file is saved under the extension's type. A
  password-protected PDF cannot be told apart from a damaged one without
  native work, so it keeps the generic sentence.
- No Move earlier on the first page or Move later on the last; a move is
  announced ("Moved to page 2 of 3").
- "Scanned document", "Back to pages" and "Back to sources" are in the copy
  table; the details placeholder isolates the file name.
- Cancel while reading a scan returns to review with the pages kept (the
  handover is silent; the pages were already chosen). A photo or file still
  goes back to the sources and loses its copies.

## Tests

- `src/__tests__/scan-flow.test.tsx` (new, 33): sources, no camera, camera
  denied (on request, already refused, before the iOS scanner), Photos
  without permission, unsupported and unreadable files with copy removal,
  untyped files, review (remove, last page, Discard, reorder by actions and
  by the Move buttons with the saved order checked, Add pages, late Add
  pages after close, unmount, Back to pages), processing (Cancel while
  reading for scans and files, late OCR result, no Cancel and the announced
  sentence while encrypting, inline failure and Try again, no duplicate on a
  fields-only failure), details (suggested, masked, remove a value, title
  error, saved toast and View), the lock (during review, during reading,
  before the save wrote).
- `src/__tests__/add-document.test.tsx`: kept, with the capture-row cases
  updated to the four rows and the scan Back case moved to Back to pages and
  Discard; every residue case still runs.
- `src/features/scan/__tests__/pages.test.ts`: file types, page moves, copy.
- `src/data/__tests__/DocumentRepository.test.ts`: snippet marks, diacritics,
  title-only hits, empty queries, expiry, newest and oldest order.
- `src/__tests__/library-screen.test.tsx`: both matched words highlighted,
  no snippet for a title match, expiry sort through `listDocuments`.
- `npm run validate`: exit 0 (68 suites, 534 tests, expo-doctor 20/20). The
  "worker failed to exit gracefully" warning is already on the base.

## Native QA owed (not run here)

No native code changed. Not run: simulator, emulator, physical devices.

1. iOS device and Android phone: Scan with the camera, 3 pages, review
   (remove, hold and move, Add pages, Discard), Continue, Cancel while
   reading, save; check the pages are in the chosen order in the viewer.
2. iOS: deny camera at the first prompt from Scan; callout, Open Settings,
   allow, return; callout gone. Android: deny Take a photo twice.
3. Simulator (no camera): both camera rows disabled, no crash.
4. Files: a `.numbers` or `.txt` file, a password-protected PDF, a HEIC
   photo, and an Android provider that ignores the type filter.
5. Lock (auto-lock Immediately) during review, during reading, during
   encrypting; check the cache, ImagePicker, scanner, DocumentPicker and tmp
   folders are empty after the lock, and the notice after unlock.
6. VoiceOver and TalkBack: page actions, step announcements, "This can't be
   stopped." announced, the inline save error read as an alert.
7. AX5 text, RTL (Arabic title "عقد الإيجار 2026.pdf"), dark mode, reduced
   motion.
8. Library search: snippet highlight on device text (SQLCipher FTS5), sort
   by expiry date.
