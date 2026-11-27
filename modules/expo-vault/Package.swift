// swift-tools-version:5.9
// Pure-Foundation/CryptoKit subset of ios/ for macOS `swift test` without Xcode/simulator.
import PackageDescription

let package = Package(
  name: "ExpoVaultFormats",
  platforms: [.macOS(.v13)],
  targets: [
    .target(
      name: "VaultFormats",
      path: "ios",
      exclude: [
        "ExpoVault.podspec",
        "ExpoVaultModule.swift",
        "ExpoVaultModule+Auth.swift",
        "ExpoVaultModule+Backup.swift",
        "ExpoVaultModule+Entries.swift",
        "PdfPages.swift",
        "VaultCrypto+Thumbnail.swift",
        "VaultKeychain.swift",
      ],
      sources: [
        "BackupContainer.swift",
        "BackupContainer+IO.swift",
        "BackupError.swift",
        "BackupPreflight.swift",
        "BackupStaging.swift",
        "RestoreCancelFlag.swift",
        "SealedKey.swift",
        "VaultCrypto.swift",
      ]
    ),
    .testTarget(
      name: "VaultFormatsTests",
      dependencies: ["VaultFormats"],
      path: "tests/swift"
    ),
  ]
)
