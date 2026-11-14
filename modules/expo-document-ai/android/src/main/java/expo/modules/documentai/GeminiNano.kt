package expo.modules.documentai

import android.util.Log
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import kotlinx.coroutines.flow.first

/** Only referenced on API 26 and later; see [ExpoDocumentAiModule]. */
internal object GeminiNano {
  private const val TAG = "ExpoDocumentAi"
  private val model: GenerativeModel by lazy { Generation.getClient() }

  /**
   * AVAILABLE is the only state the app uses. A model that still has to be
   * downloaded is reported as such; the app downloads it only when the owner
   * asks in Settings ([download]).
   */
  suspend fun info(): Map<String, Any?> {
    val status = try {
      model.checkStatus()
    } catch (e: Exception) {
      Log.w(TAG, "Gemini Nano status check failed", e)
      return mapOf("engine" to "gemini-nano", "status" to "unavailable", "reason" to (e.message ?: "status"))
    }
    Log.i(TAG, "Gemini Nano feature status $status")
    val name = when (status) {
      FeatureStatus.AVAILABLE -> "available"
      FeatureStatus.DOWNLOADABLE -> "downloadable"
      FeatureStatus.DOWNLOADING -> "downloading"
      else -> "unavailable"
    }
    return mapOf("engine" to "gemini-nano", "status" to name, "reason" to null)
  }

  /**
   * Asks AICore to download the model for the Prompt API. Only called when the
   * owner taps Download in Settings; resolves when AICore reports it complete.
   */
  suspend fun download() {
    val last = model.download().first {
      it is DownloadStatus.DownloadCompleted || it is DownloadStatus.DownloadFailed
    }
    if (last is DownloadStatus.DownloadFailed) throw last.e
    Log.i(TAG, "Gemini Nano download completed")
  }

  /**
   * One prompt with the instructions and the document text. Temperature 0 and
   * top-k 1 keep the answer stable for the same text; the caller parses the
   * JSON and checks every value against the text before it is shown.
   */
  suspend fun extract(instructions: String, text: String): String {
    if (model.checkStatus() != FeatureStatus.AVAILABLE) throw ModelUnavailableException("not-ready")
    val request = generateContentRequest(TextPart("$instructions\n\nDocument text:\n$text")) {
      temperature = 0f
      topK = 1
      maxOutputTokens = 256
    }
    val answer = model.generateContent(request).candidates.firstOrNull()?.text
    return answer ?: throw ModelUnavailableException("empty-answer")
  }
}
