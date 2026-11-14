package expo.modules.documentai

import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ModelUnavailableException(reason: String) :
  CodedException("MODEL_UNAVAILABLE", "The on-device model is not available: $reason.", null)

class ModelFailedException(cause: Throwable) :
  CodedException("MODEL_FAILED", cause.message ?: "The on-device model did not answer.", cause)

/**
 * Gemini Nano through ML Kit's GenAI Prompt API. The model runs in Android
 * AICore on the device; the text never leaves it. ML Kit GenAI needs API 26,
 * so [GeminiNano] is only loaded from there on.
 */
class ExpoDocumentAiModule : Module() {
  private val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O

  override fun definition() = ModuleDefinition {
    Name("ExpoDocumentAi")

    AsyncFunction("modelInfo") Coroutine { ->
      if (!supported) {
        mapOf("engine" to "gemini-nano", "status" to "unavailable", "reason" to "android-version")
      } else {
        GeminiNano.info()
      }
    }

    AsyncFunction("downloadModel") Coroutine { ->
      if (!supported) throw ModelUnavailableException("android-version")
      try {
        GeminiNano.download()
      } catch (e: Exception) {
        throw ModelFailedException(e)
      }
    }

    AsyncFunction("extractDetails") Coroutine { instructions: String, text: String ->
      if (!supported) throw ModelUnavailableException("android-version")
      try {
        GeminiNano.extract(instructions, text)
      } catch (e: CodedException) {
        throw e
      } catch (e: Exception) {
        throw ModelFailedException(e)
      }
    }
  }
}
