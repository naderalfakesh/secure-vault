# ADR 0006: Rasterise PDFs in the vault module instead of embedding a PDF view

- Status: Accepted
- Date: 2026-09-07

## Context

Phase 7 needs pinch-zoom viewing of every document, a page strip for
multi-page documents, and a share path that decrypts to a temporary copy and
cleans it up. Documents are either photos (one or more JPEG pages) or PDFs.
A PDF view such as `react-native-pdf` would add a native dependency, a
second viewer with its own gestures and page navigation, and a second code
path for thumbnails, sharing, and OCR.

## Decision

The vault module gains one function,
`renderPdfPages(sourcePath, maxPixelSize, destDir)`, implemented with PDFKit
on iOS and `PdfRenderer` on Android. It writes one JPEG per page into a cache
directory and returns their URIs and sizes. `DocumentService.getDocumentPages`
returns image URIs for every document: decrypted JPEG pages for photo
documents, rasterised pages for PDFs. A PDF's thumbnail is its rendered first
page.

The viewer is one component, `PageViewer`, built on the image-toolset-modern
gestures: a horizontal pager of `ZoomablePage`s with pinch, pan, double-tap,
drag-to-dismiss, and a thumbnail strip. It never sees a PDF.

Sharing copies the decrypted file to `cache/share/<title>.<ext>` so the
receiving app sees the document's name rather than an internal id, opens the
system sheet through `expo-sharing` inside the auto-lock suspension, and
deletes the copy in a `finally`. `clearCache` also sweeps the share
directory, the rendered pages, and the undo copies.

Delete keeps decrypted copies of the document's files in the cache for six
seconds and re-encrypts them under the original id and dates if the user
taps Undo; after the window the copies are removed. The encrypted originals
are gone the moment Delete is tapped, so a crash inside the window loses
nothing more than the undo.

## Consequences

- One viewer, one thumbnail path, one share path, and OCR works on the first
  page of a PDF for free.
- Rendering at 2048 px on the long side is enough for full-screen zoom on a
  3x phone; text-heavy pages are readable at the double-tap scale. Vector
  fidelity at extreme zoom is lost, which is accepted for this app.
- Large PDFs cost a render per open. Pages render in the cache and are
  reused within a session; the cache is swept on lock.
- Undo relies on cache files that exist decrypted for six seconds. This is
  the same exposure as a preview, and the window is short by design.

## Alternatives considered

- `react-native-pdf`: rejected for the reasons in Context.
- A native `PDFView` inside the module: keeps fidelity but duplicates the
  viewer, and the gesture model would differ between photos and PDFs.
- Soft delete in the index with a `deletedAt` column: cleaner undo, but every
  query and count would need to filter it and the encrypted bytes would
  linger. The snapshot approach keeps the index honest.
