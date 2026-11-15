# ADR 0009: Hardware-bound device key

- Status: Accepted
- Date: 2026-11-15
- Builds on: [ADR 0002](0002-encrypted-sqlite-index-and-key-hierarchy.md), [ADR 0003](0003-session-and-pin-model.md)

## Context

The device key encrypts every vault entry and wraps the index key. On
Android it has always been a non-exportable Keystore key: the app holds a
reference, the Keystore runs each AES-GCM call, and on phones like the
Pixel 9 that happens in the trusted execution environment. On iOS it was 32
random bytes in a Keychain item guarded by `userPresence`. The Keychain item
is device-bound and access-controlled, but the key itself is plain data
that the Keychain hands to the app; no key hardware is involved in opening
it, and `docs/SECURITY.md` said so.

The Secure Enclave cannot hold an AES key or encrypt files. It can hold a
P-256 key that never leaves it, behind its own user-presence check.

## Decision

### iOS: seal the vault key to a Secure Enclave key (SVK1)

- On a device with an enclave, `createVault` makes a Secure Enclave P-256
  key-agreement key with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`,
  `privateKeyUsage` and `userPresence`, and seals the 32-byte vault key to
  it: a fresh ephemeral P-256 key agrees with the enclave key, HKDF-SHA256
  (salt: the ephemeral public key, info: `SecureVault SVK1 vault key`)
  gives the wrapping key, and AES-256-GCM seals the vault key with the magic
  and ephemeral key as associated data.
- The result is one Keychain item, account `sealedKey`, holding
  `SVK1 | u16 length | enclave key blob | ephemeral public key | nonce |
sealed key | tag`. The enclave key blob is the enclave's own encrypted
  handle; on another device it opens nothing. The item has no access control
  of its own (the enclave key has it), so reading it never prompts.
- Opening runs the key agreement in the enclave with the session's
  `LAContext`. The unlock already evaluated that context, so the user sees
  one prompt per unlock, as before.
- Existing vaults keep working. The first unlock on a device with an
  enclave reads the plain `encryptionKey` item, seals it, writes the sealed
  item, opens it with the same context and compares, and only then deletes
  the plain item. A failure at any step deletes the half-written sealed item
  and keeps the plain one. If both exist after an interruption, the sealed
  one is used and the plain one is removed.
- Without an enclave (the simulator) the plain item stays, and Settings says
  "the iOS Keychain".
- The session now keeps the key its context opened, next to the context,
  so thumbnails and pages do not run a key agreement each. Locking drops
  both. The key was already in memory for every operation; it now stays
  there for the unlocked session, which auto-lock bounds.

### Android: report, do not move

- The Keystore key already never leaves the Keystore. The module reads its
  `KeyInfo` and reports `trusted-environment`, `strongbox` or `software`.
- New keys are not created in StrongBox. Every file chunk goes through the
  Keystore, and Android describes StrongBox as slower and
  resource-constrained, meant for small keys. Using StrongBox would mean a
  wrapping key there and the file key in app memory, which is weaker than
  today's TEE key for the files themselves.

### What the app says

`keyProtection()` returns `secure-enclave`, `keychain`, `strongbox`,
`trusted-environment`, `software` or `none`. "How your data is protected"
names the Secure Enclave or secure hardware only for those answers and
keeps the plain Keychain or Keystore sentence otherwise, including while
the answer is loading.

## Consequences

- A copy of the iOS Keychain, from a backup tool or a compromised OS at
  rest, no longer contains a usable vault key: opening it needs this
  device's enclave and the user's presence.
- While unlocked, the key is still in app memory; the enclave does not
  change what a process-level attacker on an unlocked phone sees.
- The SVK1 format is tested on the Mac with `swift test` (software P-256 in
  the enclave's place, then this Mac's own Secure Enclave). The simulator
  has no enclave, so the migration and the single-prompt unlock on a
  physical iPhone are owed (docs/verification/hardware-bound-keys.md).
- `deleteDeviceKey` (a reinstall that finds an old key) deletes every item
  of the service, the sealed key included; the enclave key then has no
  handle left and nothing can use it.
