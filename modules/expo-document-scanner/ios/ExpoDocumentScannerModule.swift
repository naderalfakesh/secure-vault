import ExpoModulesCore
import UIKit
import VisionKit

/// Wraps VisionKit's document camera: edge detection, auto capture, perspective
/// correction, and multi-page capture come from the platform. Pages are written
/// as JPEGs to the cache directory and their paths returned to JavaScript, which
/// encrypts them into the vault and deletes the temporary files.
public class ExpoDocumentScannerModule: Module {
  private var delegate: ScannerDelegate?

  public func definition() -> ModuleDefinition {
    Name("ExpoDocumentScanner")

    Function("isSupported") { () -> Bool in
      VNDocumentCameraViewController.isSupported
    }

    AsyncFunction("scanDocuments") { (options: ScanOptions, promise: Promise) in
      guard VNDocumentCameraViewController.isSupported else {
        promise.reject("SCANNER_UNAVAILABLE", "The document camera is not available on this device.")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("NO_VIEW_CONTROLLER", "No view controller to present the scanner from.")
        return
      }
      let controller = VNDocumentCameraViewController()
      let delegate = ScannerDelegate(quality: options.quality, maxPages: options.maxPages) { result in
        self.delegate = nil
        switch result {
        case .success(let pages): promise.resolve(pages)
        case .failure(let error): promise.reject("SCAN_FAILED", error.localizedDescription)
        }
      }
      self.delegate = delegate
      controller.delegate = delegate
      presenter.present(controller, animated: true)
    }.runOnQueue(.main)
  }
}

struct ScanOptions: Record {
  @Field var quality: Double = 0.85
  @Field var maxPages: Int = 20
}

private final class ScannerDelegate: NSObject, VNDocumentCameraViewControllerDelegate {
  enum ScanError: Error, LocalizedError {
    case encoding
    var errorDescription: String? { "Could not encode a scanned page." }
  }

  private let quality: Double
  private let maxPages: Int
  private let completion: (Result<[[String: Any]], Error>) -> Void

  init(quality: Double, maxPages: Int, completion: @escaping (Result<[[String: Any]], Error>) -> Void) {
    self.quality = quality
    self.maxPages = maxPages
    self.completion = completion
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
    controller.dismiss(animated: true)
    do {
      var pages: [[String: Any]] = []
      let directory = FileManager.default.temporaryDirectory
      let batch = UUID().uuidString
      for index in 0..<min(scan.pageCount, maxPages) {
        let image = scan.imageOfPage(at: index)
        guard let data = image.jpegData(compressionQuality: quality) else { throw ScanError.encoding }
        let url = directory.appendingPathComponent("scan_\(batch)_\(index).jpg")
        try data.write(to: url, options: .atomic)
        pages.append([
          "uri": url.absoluteString,
          "width": Int(image.size.width * image.scale),
          "height": Int(image.size.height * image.scale),
        ])
      }
      completion(.success(pages))
    } catch {
      completion(.failure(error))
    }
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    controller.dismiss(animated: true)
    completion(.success([]))
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
    controller.dismiss(animated: true)
    completion(.failure(error))
  }
}
