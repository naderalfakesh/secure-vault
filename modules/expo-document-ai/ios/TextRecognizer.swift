import ExpoModulesCore
import Foundation
import ImageIO
import Vision

final class TextRecognitionFailedException: GenericException<String> {
  override var code: String { "TEXT_RECOGNITION_FAILED" }
  override var reason: String { "Could not read text from the image: \(param)." }
}

/// Apple Vision text recognition (ADR 0011). Runs on the device with the
/// system's own models: no third-party framework, nothing sent anywhere.
/// Returns one entry per recognised line, framed in the upright image's
/// pixels with a top-left origin; the app groups lines into blocks itself.
enum TextRecognizer {
  static func recognize(path: String) throws -> [String: Any] {
    let url = path.hasPrefix("file://") ? URL(string: path) : URL(fileURLWithPath: path)
    guard let url,
      let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
      throw TextRecognitionFailedException("unreadable-image")
    }
    let orientation = imageOrientation(source)

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.automaticallyDetectsLanguage = true
    let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
    do {
      try handler.perform([request])
    } catch {
      throw TextRecognitionFailedException(error.localizedDescription)
    }

    // Vision's boxes are normalised to the upright image, origin bottom-left.
    let quarterTurn: [CGImagePropertyOrientation] = [.left, .leftMirrored, .right, .rightMirrored]
    let turned = quarterTurn.contains(orientation)
    let width = Double(turned ? image.height : image.width)
    let height = Double(turned ? image.width : image.height)

    let lines: [[String: Any]] = (request.results ?? []).compactMap { observation in
      guard let candidate = observation.topCandidates(1).first else { return nil }
      let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !text.isEmpty else { return nil }
      let box = observation.boundingBox
      return [
        "text": text,
        "frame": [
          "left": Double(box.minX) * width,
          "top": Double(1 - box.maxY) * height,
          "width": Double(box.width) * width,
          "height": Double(box.height) * height,
        ],
      ]
    }
    return ["width": width, "height": height, "lines": lines]
  }

  private static func imageOrientation(_ source: CGImageSource) -> CGImagePropertyOrientation {
    let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
    let raw = (properties?[kCGImagePropertyOrientation] as? NSNumber)?.uint32Value ?? 1
    return CGImagePropertyOrientation(rawValue: raw) ?? .up
  }
}
