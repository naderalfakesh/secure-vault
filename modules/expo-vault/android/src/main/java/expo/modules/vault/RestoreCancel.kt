package expo.modules.vault

/**
 * The cancel request of a restore, tied to the restore's run id. A request names its run: it acts
 * on the running restore with that id, or is kept for the next one to start while none runs, and
 * only a restore with that id honours it. A request for any other id (one that already ended, or
 * while a different one runs) is ignored and answers false, and a kept request for another id is
 * discarded when a restore starts. The last cancel point and a request exclude each other under
 * one lock, so a request answered true is always honoured.
 */
class RestoreCancel {
    private enum class State { OPEN, CANCEL, COMMITTED }

    private var state = State.OPEN
    private var current: String? = null
    private var lastEnded: String? = null
    private var pending: String? = null

    /** A restore with [runId] starts; a request kept for it is honoured, any other is dropped. */
    @Synchronized
    fun start(runId: String) {
        current = runId
        state = if (pending == runId) State.CANCEL else State.OPEN
        pending = null
    }

    /** The restore with [runId] ended, either way. */
    @Synchronized
    fun finish(runId: String) {
        if (current != runId) return
        current = null
        lastEnded = runId
        state = State.OPEN
    }

    /** True when the restore with [runId] will honour the request. */
    @Synchronized
    fun request(runId: String): Boolean {
        val running = current
        if (running != null) {
            if (running != runId || state == State.COMMITTED) return false
            state = State.CANCEL
            return true
        }
        if (runId == lastEnded) return false
        pending = runId
        return true
    }

    @get:Synchronized
    val isRequested: Boolean
        get() = state == State.CANCEL

    /** Marks the last cancel point passed; false when a cancel was asked first. */
    @Synchronized
    fun commit(): Boolean {
        if (state == State.CANCEL) return false
        state = State.COMMITTED
        return true
    }
}
