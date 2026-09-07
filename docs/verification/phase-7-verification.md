# Phase 7 verification

> Verified: 2026-09-07
>
> Scope: zoomable page viewer with a page strip, PDF rendering, share with a
> named temporary copy and guaranteed cleanup, delete with undo, edit details,
> delete everything

## Outcome

Every document opens in one viewer, `PageViewer`, built on the
image-toolset-modern gestures: pinch, pan, double-tap, drag down to dismiss,
a tap to hide the chrome, and a thumbnail strip for multi-page documents.
PDFs are rasterised in the vault module so the viewer, thumbnails, OCR, and
suggestions all work on them without a PDF view. Sharing copies the decrypted
file under the document's own name and removes it once the sheet closes.
Delete leaves the screen at once and offers Undo for five seconds.
[ADR 0006](../adr/0006-rasterise-pdfs-in-the-vault-module.md) records the
choices.

## Native run evidence

iOS, iPhone 17 Pro simulator, development client rebuilt with the PDF
renderer and `expo-sharing`:

1. Viewer. Tapping the passport preview opens it full screen. A two-finger
   pinch zooms around the fingers (`docs/images/viewer-zoom-ios.png`), a
   double tap returns to rest, a single tap hides the header, and a drag down
   dismisses back to the detail screen.
2. Edit details. The pencil opens a sheet with the title, category chips, and
   tags (`docs/images/edit-details-ios.png`); saving updates the title on the
   detail screen with a "Details updated" toast.
3. Share. With Confirm before sharing on, Share prompts Face ID, then the
   sheet shows "passport of Jane Doe", JPEG image, rather than an internal id
   (`docs/images/share-named-ios.png`). While the sheet is up the copy exists
   at `Library/Caches/share/passport of Jane Doe.jpg`; after dismissing it the
   directory is empty.
4. Delete with undo. Delete returns to Home, the count drops from four to
   three, and the toast reads Deleted "passport of Jane Doe" with Undo. The
   decrypted copy `undo_<id>.jpg` exists in the cache during the window and is
   gone afterwards. The undo tap in this run landed after the window had
   closed, so the document stayed deleted; the same flow with a prompt tap is
   in the Android evidence below.
5. PDF. A two-page lease placed in Files, On My iPhone, imports through
   "Import a file". Since commit 1816a42 the Details form shows the rendered
   first page and reads it: title "Residential Lease Agreement", category
   Legal, Expires 30 Sep 2027 (`docs/images/add-pdf-ios.png`). The detail
   screen shows the rendered page, a "2 pages" badge, and a strip with pages
   1 and 2 (`docs/images/pdf-pages-ios.png`); tapping page 2 opens the viewer
   at "2 of 2" with the strip (`docs/images/viewer-strip-ios.png`). "Read the
   text" extracts the first page's text from a PDF.
6. Home now lists the lease with its rendered cover as the thumbnail.

Android, Medium Phone emulator, API 36.1, fresh install of the rebuilt APK:

1. Onboarding and PIN setup again, then the passport from Photos with the
   same suggestions as iOS.
2. Viewer opens from the preview with "Page 1 of 1" and Close viewer; the
   Android share sheet opens with "Sharing image" and the share directory is
   empty afterwards.
3. Delete returns to Home with the Undo toast. Undo tapped within a second
   put the document back; a later attempt that tapped after the window found
   nothing to restore, which led to the longer copy lifetime in commit
   b9678d0.
4. The PDF from Downloads imports through the system picker with the
   rendered preview, the title, Legal, and the expiry; the detail's "Open
   page 2" jumps the viewer to "Page 2 of 2" with the strip.

## Defects found by the run

- After about five minutes, every vault call on Android failed with "Failed
  to encrypt file: User not authenticated": the Keystore's 300-second
  authentication window had lapsed while the app stayed unlocked. The module
  now reports this as `KEY_LOCKED` and a wrapper around the native module
  re-prompts the system credential once and retries (commit 29e5c0b, recorded
  in ADR 0003).
- The undo copies were discarded at the same moment the toast hid, so a tap
  on a fading Undo could find nothing; the copies now outlive the toast by
  three seconds (commit b9678d0).
- The development client's floating button sits over the Delete header
  button on both platforms; it was turned off from the dev menu for the run.
  Production builds have no such button.

## Quality gate

`npm run validate` passes: Prettier, ESLint, TypeScript 6 strict, Jest
(13 suites, 53 tests), Expo Doctor. New tests cover share file naming, PDF
page rasterisation through the mock, delete with a restorable snapshot, the
PDF preview helper, and the key-window recovery wrapper.

## Deferred

- The viewer's rotation gesture from the sibling viewer was left out; pages
  from the scanner are already straightened.
- Rendering very large PDFs happens on open; pages are not cached across
  sessions by design, since the cache is swept on lock.
