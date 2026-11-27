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

/**
 * Android lifecycle tracking for share-chooser pauses, timed share-copy expiry,
 * and privacy-preserving clipboard timestamps.
 */
internal class ShareExpiryController {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var shareExpiry: Pair<String, Runnable>? = null

    // Wall-clock time an activity of the app was last stopped (Home, Recents, another app
    // opened over it), 0 before any. The share chooser is translucent, so it leaves the
    // activity paused, never stopped: a stop while a share pause runs means the user left.
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

    /**
     * Deletes a share copy's folder after [delayMs], even while the chooser pauses JS timers.
     * Only a folder directly inside `<cacheDir>/share` qualifies. One expiry at a time.
     */
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
                // The lock and launch sweeps remove the share folder too.
            }
        }
        shareExpiry = path to expire
        mainHandler.postDelayed(expire, delayMs.toLong().coerceAtLeast(0L))
    }

    /** Cancels the expiry for [path] once its share ended; another path's is kept. */
    fun cancel(path: String) {
        val pending = shareExpiry
        if (pending != null && pending.first == path) {
            mainHandler.removeCallbacks(pending.second)
            shareExpiry = null
        }
    }

    /** When the primary clip was set, without reading its contents, or null when unknown. */
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
