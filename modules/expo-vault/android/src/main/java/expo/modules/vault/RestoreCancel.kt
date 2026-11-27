package expo.modules.vault

/** Run-scoped cooperative cancel state; lock ensures request() returning true is always honoured before commit(). */
class RestoreCancel {
    private enum class State { OPEN, CANCEL, COMMITTED }

    private var state = State.OPEN
    private var current: String? = null
    private var lastEnded: String? = null
    private var pending: String? = null

    @Synchronized
    fun start(runId: String) {
        current = runId
        state = if (pending == runId) State.CANCEL else State.OPEN
        pending = null
    }

    @Synchronized
    fun finish(runId: String) {
        if (current != runId) return
        current = null
        lastEnded = runId
        state = State.OPEN
    }

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

    @Synchronized
    fun commit(): Boolean {
        if (state == State.CANCEL) return false
        state = State.COMMITTED
        return true
    }
}
