import ExpoModulesCore
import Foundation

#if canImport(FoundationModels)
  import FoundationModels
#endif

final class ModelUnavailableException: GenericException<String> {
  override var code: String { "MODEL_UNAVAILABLE" }
  override var reason: String { "The on-device model is not available: \(param)." }
}

final class ModelFailedException: GenericException<String> {
  override var code: String { "MODEL_FAILED" }
  override var reason: String { param }
}

/// Apple's on-device Foundation Model (iOS 26 and later, Apple Intelligence on).
/// The text never leaves the device. On older systems the module answers
/// "unavailable" and the app keeps its heuristic suggestions.
public final class ExpoDocumentAiModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoDocumentAi")

    AsyncFunction("modelInfo") { () -> [String: Any?] in
      #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
          return AppleModel.info()
        }
      #endif
      return ["engine": "apple-foundation-models", "status": "unavailable", "reason": "ios-version"]
    }

    // Apple downloads its model with Apple Intelligence; there is nothing to start here.
    AsyncFunction("downloadModel") { () throws in
      throw ModelUnavailableException("managed-by-system")
    }

    AsyncFunction("extractDetails") { (instructions: String, text: String) async throws -> String in
      #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
          return try await AppleModel.extract(instructions: instructions, text: text)
        }
      #endif
      throw ModelUnavailableException("ios-version")
    }
  }
}

#if canImport(FoundationModels)
  /// The shape the model must answer in. Guided generation makes the framework
  /// produce exactly these fields; empty strings stand for "not in the text".
  /// The caller still checks every value against the text before showing it.
  @available(iOS 26.0, *)
  @Generable
  struct DocumentDetails {
    @Guide(description: "A short title for the document, at most six words, taken from its heading or issuer.")
    var title: String

    @Guide(
      description: "The kind of document.",
      .anyOf(["id", "medical", "finance", "legal", "insurance", "receipts", "other"])
    )
    var category: String

    @Guide(description: "The expiry or end date as YYYY-MM-DD, or an empty string if the text gives none.")
    var expires: String

    @Guide(description: "The issue date as YYYY-MM-DD, or an empty string if the text gives none.")
    var issued: String

    @Guide(description: "The passport, policy, account or document number exactly as printed, or an empty string.")
    var number: String

    @Guide(description: "Up to three short lowercase tags.", .maximumCount(3))
    var tags: [String]
  }

  @available(iOS 26.0, *)
  enum AppleModel {
    static func info() -> [String: Any?] {
      #if targetEnvironment(simulator)
        // The simulator reports the model as available, then refuses every
        // request ("Simulator is not supported"); say so instead of failing per document.
        return ["engine": "apple-foundation-models", "status": "unavailable", "reason": "simulator"]
      #else
        return deviceInfo()
      #endif
    }

    private static func deviceInfo() -> [String: Any?] {
      switch SystemLanguageModel.default.availability {
      case .available:
        return ["engine": "apple-foundation-models", "status": "available", "reason": nil]
      case .unavailable(let reason):
        // modelNotReady: Apple Intelligence is on but the model is still downloading.
        let status = "\(reason)" == "modelNotReady" ? "downloading" : "unavailable"
        return ["engine": "apple-foundation-models", "status": status, "reason": "\(reason)"]
      @unknown default:
        return ["engine": "apple-foundation-models", "status": "unavailable", "reason": "unknown"]
      }
    }

    static func extract(instructions: String, text: String) async throws -> String {
      guard case .available = SystemLanguageModel.default.availability else {
        throw ModelUnavailableException("not-ready")
      }
      let session = LanguageModelSession(instructions: instructions)
      let details: DocumentDetails
      do {
        details = try await session.respond(
          to: "Document text:\n\(text)",
          generating: DocumentDetails.self,
          options: GenerationOptions(sampling: .greedy)
        ).content
      } catch {
        throw ModelFailedException(error.localizedDescription)
      }
      let object: [String: Any] = [
        "title": details.title,
        "category": details.category,
        "expires": details.expires,
        "issued": details.issued,
        "number": details.number,
        "tags": details.tags,
      ]
      let data = try JSONSerialization.data(withJSONObject: object)
      return String(decoding: data, as: UTF8.self)
    }
  }
#endif
