import Foundation
import ImageIO
import UIKit

// Kept apart from VaultCrypto.swift so the format code builds without UIKit
// and its tests run on the Mac with `swift test` (see Package.swift).
extension VaultCrypto {
  /// Downsampled JPEG for list thumbnails; orientation is applied so the
  /// thumbnail matches the photo the user took.
  static func thumbnailJPEG(from source: URL, maxPixelSize: Int) throws -> Data {
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
      kCGImageSourceShouldCache: false,
    ]
    guard let imageSource = CGImageSourceCreateWithURL(source as CFURL, nil),
      let cgImage = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, options as CFDictionary),
      let jpeg = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.8)
    else {
      throw CryptoError.corrupt("thumbnail")
    }
    return jpeg
  }
}
