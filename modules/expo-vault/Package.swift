// swift-tools-version:5.9
// The vault's file formats (SVC1 streams, SVB1 backups) as a plain Swift
// package, so their tests run on the Mac with `swift test`: no simulator, no
// app build. The app itself links these files through ios/ExpoVault.podspec;
// this package only borrows the two that need nothing beyond CryptoKit,
// CommonCrypto and Foundation.
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
        "PdfPages.swift",
        "VaultCrypto+Thumbnail.swift",
        "VaultKeychain.swift",
      ],
      sources: ["BackupContainer.swift", "VaultCrypto.swift"]
    ),
    .testTarget(
      name: "VaultFormatsTests",
      dependencies: ["VaultFormats"],
      path: "tests/swift"
    ),
  ]
)
