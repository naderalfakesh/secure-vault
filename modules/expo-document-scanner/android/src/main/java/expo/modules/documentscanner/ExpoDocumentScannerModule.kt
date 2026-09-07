package expo.modules.documentscanner

import android.app.Activity
import android.content.Intent
import android.graphics.BitmapFactory
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class ScanOptions : Record {
  @Field val quality: Double = 0.85
  @Field val maxPages: Int = 20
}

/**
 * Wraps the ML Kit Document Scanner: a Google-provided activity with edge
 * detection, auto capture, cleanup filters, and multi-page capture. Pages come
 * back as content URIs that JavaScript copies into the vault.
 */
class ExpoDocumentScannerModule : Module() {
  private var pending: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoDocumentScanner")

    Function("isSupported") { true }

    AsyncFunction("scanDocuments") { options: ScanOptions, promise: Promise ->
      val activity = appContext.currentActivity
        ?: return@AsyncFunction promise.reject("NO_ACTIVITY", "No activity to launch the scanner from.", null)
      if (pending != null) {
        promise.reject("SCAN_IN_PROGRESS", "A scan is already running.", null)
        return@AsyncFunction
      }
      pending = promise
      val scannerOptions = GmsDocumentScannerOptions.Builder()
        .setGalleryImportAllowed(false)
        .setPageLimit(options.maxPages)
        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
        .build()
      GmsDocumentScanning.getClient(scannerOptions)
        .getStartScanIntent(activity)
        .addOnSuccessListener { intentSender ->
          try {
            activity.startIntentSenderForResult(intentSender, REQUEST_CODE, null, 0, 0, 0)
          } catch (e: Exception) {
            pending = null
            promise.reject("SCAN_FAILED", e.message, e)
          }
        }
        .addOnFailureListener { e ->
          pending = null
          promise.reject("SCANNER_UNAVAILABLE", e.message ?: "The document scanner is not available.", e)
        }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null
      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(emptyList<Map<String, Any>>())
        return@OnActivityResult
      }
      val result = GmsDocumentScanningResult.fromActivityResultIntent(payload.data as Intent?)
      val pages = result?.pages.orEmpty().map { page ->
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        appContext.reactContext?.contentResolver?.openInputStream(page.imageUri)?.use {
          BitmapFactory.decodeStream(it, null, bounds)
        }
        mapOf("uri" to page.imageUri.toString(), "width" to bounds.outWidth, "height" to bounds.outHeight)
      }
      promise.resolve(pages)
    }
  }

  companion object {
    private const val REQUEST_CODE = 0x5CA1
  }
}
