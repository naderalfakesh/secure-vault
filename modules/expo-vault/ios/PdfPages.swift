import Foundation
import PDFKit
import UIKit

enum PdfPagesError: LocalizedError {
  case unreadable

  var errorDescription: String? {
    switch self {
    case .unreadable: return "Could not open the PDF"
    }
  }
}

/// Rasterises PDF pages to JPEG files so the viewer only ever deals with
/// images. Rendering happens from a decrypted temporary copy and the output
/// lives in the cache directory next to the other decrypted previews.
enum PdfPages {
  static func render(from source: URL, maxPixelSize: Int, into directory: URL) throws -> [[String: Any]] {
    guard let document = PDFDocument(url: source) else { throw PdfPagesError.unreadable }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var pages: [[String: Any]] = []
    for index in 0..<document.pageCount {
      guard let page = document.page(at: index) else { continue }
      let bounds = page.bounds(for: .mediaBox)
      let scale = CGFloat(maxPixelSize) / max(bounds.width, bounds.height, 1)
      let size = CGSize(width: max(1, bounds.width * scale), height: max(1, bounds.height * scale))
      let format = UIGraphicsImageRendererFormat.default()
      format.scale = 1
      let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
        UIColor.white.setFill()
        context.fill(CGRect(origin: .zero, size: size))
        context.cgContext.translateBy(x: 0, y: size.height)
        context.cgContext.scaleBy(x: scale, y: -scale)
        context.cgContext.translateBy(x: -bounds.origin.x, y: -bounds.origin.y)
        page.draw(with: .mediaBox, to: context.cgContext)
      }
      guard let jpeg = image.jpegData(compressionQuality: 0.85) else { continue }
      let url = directory.appendingPathComponent("page_\(index + 1).jpg")
      try jpeg.write(to: url, options: .atomic)
      pages.append(["uri": url.absoluteString, "width": Int(size.width), "height": Int(size.height)])
    }
    return pages
  }
}
