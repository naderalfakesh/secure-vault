import CryptoKit
import Foundation
import XCTest

@testable import VaultFormats

/// SVB1, the passphrase backup that moves a vault between iPhone and Android.
final class BackupContainerTests: XCTestCase {
  private var scratch: Scratch!

  override func setUpWithError() throws { scratch = try Scratch() }
  override func tearDown() { scratch.remove() }

  private struct Restored: Equatable {
    let key: String
    let kind: String
    let plaintext: Data
  }

  /// Runs a full restore and returns what `handle` was given, in order.
  private func restore(
    _ source: URL, passphrase: String,
    isCancelled: @escaping () -> Bool = { false },
    preflight: @escaping ([BackupContainer.EntryInfo]) throws -> Void = { _ in }
  ) throws -> [Restored] {
    var restored: [Restored] = []
    try BackupContainer.read(
      from: source, passphrase: passphrase, staging: try scratch.staging(), validate: { _ in },
      progress: { _, _, _ in }, preflight: preflight, isCancelled: isCancelled
    ) { meta, plain in
      restored.append(Restored(key: meta.key, kind: meta.kind, plaintext: try Data(contentsOf: plain)))
    }
    return restored
  }

  private func outcome(of error: Error) -> String {
    switch error {
    case BackupError.corrupt: return "corrupt"
    case BackupError.passphrase: return "passphrase"
    case BackupError.unsupported: return "unsupported"
    case BackupError.cancelled: return "cancelled"
    default: return "other: \(error)"
    }
  }

  private func stagingIsEmpty() throws -> Bool {
    try FileManager.default.contentsOfDirectory(atPath: try scratch.staging().url.path).isEmpty
  }

  /// Every vector, including the ones damaged only in their last entry: the
  /// restore must either hand over every entry or refuse before `handle`
  /// sees the first one, and leave no plaintext in staging either way.
  func testMeetsEveryBackupVector() throws {
    for vector in Fixtures.vectors.backups {
      var restored: [Restored] = []
      var failure: String?
      do {
        restored = try restore(Fixtures.url(vector.file), passphrase: vector.passphrase)
      } catch {
        failure = outcome(of: error)
      }
      XCTAssertEqual(failure ?? "ok", vector.expect, vector.name)
      if vector.expect == "ok" {
        let expected = try (vector.entries ?? []).map {
          Restored(key: $0.key, kind: $0.kind, plaintext: try Fixtures.data($0.plaintext))
        }
        XCTAssertEqual(restored, expected, vector.name)
      } else {
        XCTAssertTrue(restored.isEmpty, "\(vector.name) reached handle")
      }
      XCTAssertTrue(try stagingIsEmpty(), "\(vector.name) left files in staging")
    }
  }

  /// 2,000,000,000 PBKDF2 rounds would take hours; the header is refused first.
  func testRefusesAnUnsupportedIterationCountBeforeDerivingAKey() throws {
    let started = Date()
    XCTAssertThrowsError(try restore(Fixtures.url("backup-iterations.bin"), passphrase: "x")) {
      XCTAssertEqual(outcome(of: $0), "unsupported")
    }
    XCTAssertLessThan(Date().timeIntervalSince(started), 5)
  }

  func testWritesABackupItReadsBack() throws {
    let index = scratch.file("index.db")
    let indexBytes = Data.random(count: 3 * 1024)
    try indexBytes.write(to: index)
    let document = Data.random(count: VaultCrypto.chunkSize + 100)
    var steps: [Int] = []

    let destination = scratch.file("round-trip.bin")
    let written = try BackupContainer.write(
      to: destination, passphrase: "a passphrase", staging: try scratch.staging(),
      entries: [
        .init(key: "_database_key", kind: "s", source: .staged { try Data("db key".utf8).write(to: $0) }),
        .init(key: "doc-1.jpg", kind: "f", source: .staged { try document.write(to: $0) }),
        .init(key: "database", kind: "x", source: .file(index)),
      ],
      progress: { done, _ in steps.append(done) }
    )
    XCTAssertEqual(written.entries, 3)
    XCTAssertEqual(steps, [1, 2, 3, 4])
    XCTAssertTrue(try stagingIsEmpty())

    let header = try BackupContainer.readHeader(from: destination)
    XCTAssertEqual(header.kdf.iterations, 600_000)
    XCTAssertEqual(header.entries, 4)

    XCTAssertEqual(
      try restore(destination, passphrase: "a passphrase"),
      [
        Restored(key: "_database_key", kind: "s", plaintext: Data("db key".utf8)),
        Restored(key: "doc-1.jpg", kind: "f", plaintext: document),
        Restored(key: "database", kind: "x", plaintext: indexBytes),
      ]
    )
  }

  func testACancelBeforeTheRestorePassChangesNothing() throws {
    XCTAssertThrowsError(try restore(Fixtures.url("backup.bin"), passphrase: passphrase, isCancelled: { true })) {
      XCTAssertEqual(outcome(of: $0), "cancelled")
    }
    XCTAssertTrue(try stagingIsEmpty())
  }

  func testAPreflightRefusalStopsBeforeHandle() throws {
    struct NoRoom: Error {}
    XCTAssertThrowsError(
      try restore(Fixtures.url("backup.bin"), passphrase: passphrase, preflight: { _ in throw NoRoom() })
    ) { XCTAssertTrue($0 is NoRoom) }
  }

  func testWorksOutWhatARestoreNeeds() throws {
    let layout = try BackupContainer.readLayout(from: Fixtures.url("backup.bin"))
    XCTAssertEqual(layout.map(\.meta.key), ["_check", "_database_key", "doc-1.jpg", "database"])
    let sizes = Dictionary(uniqueKeysWithValues: layout.map { ($0.meta.key, $0.payloadLength) })
    let needs = BackupContainer.restoreNeeds(layout)
    XCTAssertEqual(needs.largestString, sizes["_database_key"]! - 8)
    let restored = sizes["_database_key"]! + sizes["doc-1.jpg"]! + sizes["database"]!
    XCTAssertEqual(needs.disk, restored + 2 * sizes["doc-1.jpg"]! + sizes["database"]!)
    XCTAssertEqual(needs.scratch, 2 * sizes["_database_key"]!)
  }

  func testOnlyTheAppsOwnStagingFolderIsAccepted() throws {
    let caches = scratch.caches
    let elsewhere = scratch.root.appendingPathComponent("elsewhere")
    try FileManager.default.createDirectory(at: elsewhere, withIntermediateDirectories: true)
    let link = caches.appendingPathComponent(BackupContainer.StagingDirectory.name)
    try FileManager.default.createSymbolicLink(at: link, withDestinationURL: elsewhere)

    for requested in ["relative/backup-staging", caches.path, elsewhere.path, link.path] {
      XCTAssertThrowsError(try BackupContainer.StagingDirectory(requested: requested, caches: caches), requested)
    }
  }

  func testASweepClearsLeftoverPlaintext() throws {
    let staging = try scratch.staging()
    try Data("left by a killed export".utf8).write(to: staging.url.appendingPathComponent("plain-1"))
    try BackupContainer.sweep(staging)
    XCTAssertTrue(try stagingIsEmpty())
  }

  private var passphrase: String { "correct horse battery staple" }
}
