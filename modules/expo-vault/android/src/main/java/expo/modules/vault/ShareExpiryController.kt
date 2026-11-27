package expo.modules.vault

import android.app.Activity
import android.app.Application
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import java.io.File

internal class ShareExpiryController {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var shareExpiry: Pair<String, Runnable>? = null

    // Translucent share chooser only pauses the activity; onActivityStopped indicates the user left.
    @Volatile
    var lastStoppedAt: Long = 0L
        private set

    private var watchedApplication: Application? = null

    private val stopWatcher = object : Application.ActivityLifecycleCallbacks {
        override fun onActivityStopped(activity: Activity) {
            if (!activity.isChangingConfigurations) lastStoppedAt = System.currentTimeMillis()
        }

        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
        override fun onActivityStarted(activity: Activity) {}
        override fun onActivityResumed(activity: Activity) {}
        override fun onActivityPaused(activity: Activity) {}
        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
        override fun onActivityDestroyed(activity: Activity) {}
    }

    fun attach(context: Context?) {
        val application = context?.applicationContext as? Application
        application?.registerActivityLifecycleCallbacks(stopWatcher)
        watchedApplication = application
    }

    fun detach() {
        watchedApplication?.unregisterActivityLifecycleCallbacks(stopWatcher)
        watchedApplication = null
    }

    fun schedule(cacheDir: File, path: String, delayMs: Double) {
        val shareRoot = File(cacheDir, "share")
        val parent = File(path).parentFile?.canonicalPath
        if (!path.startsWith("/") || parent != shareRoot.canonicalPath) {
            throw IllegalArgumentException("Not a share copy folder")
        }
        shareExpiry?.let { mainHandler.removeCallbacks(it.second) }
        val expire = Runnable {
            shareExpiry = null
            try {
                BackupContainer.removeNoFollow(path, listOf(shareRoot))
            } catch (_: Exception) {
            }
        }
        shareExpiry = path to expire
        mainHandler.postDelayed(expire, delayMs.toLong().coerceAtLeast(0L))
    }

    fun cancel(path: String) {
        val pending = shareExpiry
        if (pending != null && pending.first == path) {
            mainHandler.removeCallbacks(pending.second)
            shareExpiry = null
        }
    }

    fun clipboardStamp(context: Context?): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context == null) return null
        val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return null
        val description = try {
            manager.primaryClipDescription
        } catch (e: SecurityException) {
            null
        } ?: return null
        return description.timestamp.toString()
    }
}
