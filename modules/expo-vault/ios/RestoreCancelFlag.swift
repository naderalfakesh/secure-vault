import Foundation

/// Run-scoped cooperative cancel state; lock ensures request() returning true is always honoured before commit().
final class RestoreCancelFlag {
  private enum State { case open, cancel, committed }
  private let lock = NSLock()
  private var state = State.open
  private var current: String?
  private var lastEnded: String?
  private var pending: String?

  func start(_ runId: String) {
    lock.lock()
    defer { lock.unlock() }
    current = runId
    state = pending == runId ? .cancel : .open
    pending = nil
  }

  func finish(_ runId: String) {
    lock.lock()
    defer { lock.unlock() }
    guard current == runId else { return }
    current = nil
    lastEnded = runId
    state = .open
  }

  var isRequested: Bool {
    lock.lock()
    defer { lock.unlock() }
    return state == .cancel
  }

  func request(_ runId: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if let running = current {
      if running != runId || state == .committed { return false }
      state = .cancel
      return true
    }
    if runId == lastEnded { return false }
    pending = runId
    return true
  }

  func commit() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if state == .cancel { return false }
    state = .committed
    return true
  }
}
