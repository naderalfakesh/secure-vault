import Foundation

/// The cancel request of a restore, tied to the restore's run id. A request
/// names its run: it acts on the running restore with that id, or is kept for
/// the next one to start while none runs, and only a restore with that id
/// honours it. A request for any other id (one that already ended, or while a
/// different one runs) is ignored and answers false, and a kept request for
/// another id is discarded when a restore starts. The last cancel point and a
/// request exclude each other under one lock, so a request answered true is
/// always honoured.
final class RestoreCancelFlag {
  private enum State { case open, cancel, committed }
  private let lock = NSLock()
  private var state = State.open
  private var current: String?
  private var lastEnded: String?
  private var pending: String?

  /// A restore with `runId` starts; a request kept for it is honoured, any other is dropped.
  func start(_ runId: String) {
    lock.lock()
    defer { lock.unlock() }
    current = runId
    state = pending == runId ? .cancel : .open
    pending = nil
  }

  /// The restore with `runId` ended, either way.
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

  /// True when the restore with `runId` will honour the request.
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

  /// Marks the last cancel point passed; false when a cancel was asked first.
  func commit() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if state == .cancel { return false }
    state = .committed
    return true
  }
}
