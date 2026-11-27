import Foundation
import ImageIO
import UIKit

// Split from VaultCrypto.swift so macOS `swift test` compiles without UIKit.
extension VaultCrypto {
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
