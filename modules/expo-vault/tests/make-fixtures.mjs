#!/usr/bin/env node
// Writes the cross-platform test vectors in ./fixtures for the vault's three
// file formats. The Swift and Kotlin suites both read them, so the two native
// implementations are checked against the same bytes, and those bytes come
// from a third implementation (Node's crypto) written from the format spec in
// VaultCrypto and BackupContainer, not from either app.
//
// The output is deterministic: nonces and the salt are derived from fixed
// labels, so running this again changes nothing unless the spec here changed.
// Fixed nonces are fine for fixtures and must never be copied into app code.
//
//   node modules/expo-vault/tests/make-fixtures.mjs

import { createCipheriv, createHash, pbkdf2Sync } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const KEY = sha256('SecureVault fixture key');
const PASSPHRASE = 'correct horse battery staple';
const ITERATIONS = 600_000;
const CHECK_VALUE = Buffer.from('SecureVault backup check', 'utf8');
const CREATED = '2026-11-14T00:00:00Z';

let nonceCounter = 0;

function sha256(text) {
  return createHash('sha256').update(text).digest();
}

/** A distinct, reproducible 12-byte nonce for every seal in this script. */
function nextNonce() {
  nonceCounter += 1;
  return sha256(`fixture nonce ${nonceCounter}`).subarray(0, 12);
}

function be32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
}

function be64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(value));
  return buffer;
}

/** Deterministic bytes that are not all alike, so a misplaced chunk shows. */
function pattern(length, seed) {
  const bytes = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) bytes[i] = (i * 31 + seed * 7) % 251;
  return bytes;
}

/** AES-256-GCM: returns { nonce, sealed } where sealed is ciphertext + 16-byte tag. */
function seal(key, plain, aad) {
  const nonce = nextNonce();
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  if (aad) cipher.setAAD(aad);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { nonce, sealed: Buffer.concat([body, cipher.getAuthTag()]) };
}

/**
 * SVC1 stream: "SVC1" | be32 chunkSize | per chunk be32 length | nonce |
 * ciphertext | tag, with the chunk index (be32) as the only AAD. Readers
 * take each chunk's own length and treat the chunk size as informational, so
 * a small chunk size here exercises multi-chunk files without large fixtures.
 */
function stream(key, plain, chunkSize) {
  const parts = [Buffer.from('SVC1'), be32(chunkSize)];
  for (let index = 0, offset = 0; offset < plain.length; index += 1, offset += chunkSize) {
    const { nonce, sealed } = seal(key, plain.subarray(offset, offset + chunkSize), be32(index));
    parts.push(be32(nonce.length + sealed.length), nonce, sealed);
  }
  return Buffer.concat(parts);
}

/** Byte ranges of each chunk record (length field included) in an SVC1 stream. */
function chunkRecords(bytes) {
  const records = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    records.push(bytes.subarray(offset, offset + 4 + length));
    offset += 4 + length;
  }
  return records;
}

function flip(bytes, offset) {
  const copy = Buffer.from(bytes);
  copy[offset] ^= 0x01;
  return copy;
}

/**
 * SVB1 backup: "SVB1" | be32 headerLength | header JSON, then per entry
 * be32 metaLength | meta JSON | be64 payloadLength | payload, the payload an
 * SVC1 stream under the PBKDF2-HMAC-SHA256 key. `header` overrides fields of
 * the header a version-1 exporter writes.
 */
function backup(entries, { header = {}, kdf = {}, passphrase = PASSPHRASE, salt } = {}) {
  const backupSalt = salt ?? sha256('fixture salt').subarray(0, 16);
  const iterations = kdf.iterations ?? ITERATIONS;
  // The payloads are always sealed with the count an exporter uses: a header
  // that states another count is refused before any reader derives a key.
  const key = pbkdf2Sync(passphrase, backupSalt, ITERATIONS, 32, 'sha256');
  const json = {
    version: 1,
    app: 'SecureVault',
    created: CREATED,
    kdf: { name: 'pbkdf2-hmac-sha256', iterations, salt: backupSalt.toString('base64'), ...kdf },
    cipher: 'aes-256-gcm',
    entries: entries.length,
    ...header,
  };
  const headerBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const parts = [Buffer.from('SVB1'), be32(headerBytes.length), headerBytes];
  for (const entry of entries) {
    const meta = Buffer.from(JSON.stringify({ key: entry.key, kind: entry.kind }), 'utf8');
    const payload = entry.payload ?? stream(key, entry.plain, entry.chunkSize ?? 64);
    parts.push(be32(meta.length), meta, be64(payload.length), payload);
  }
  return Buffer.concat(parts);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const files = new Map();
const save = (name, bytes) => {
  files.set(name, bytes);
  writeFileSync(join(out, name), bytes);
  return name;
};

// --- SVC1 streams -----------------------------------------------------------

const multi = pattern(200, 1);
const multiStream = stream(KEY, multi, 64); // chunks of 64, 64, 64 and 8 bytes
const records = chunkRecords(multiStream);
const header8 = multiStream.subarray(0, 8);

const streams = [
  {
    name: 'four chunks',
    file: save('stream-multichunk.bin', multiStream),
    plaintext: save('plain-multichunk.bin', multi),
  },
  {
    name: 'empty',
    file: save('stream-empty.bin', stream(KEY, Buffer.alloc(0), 1_048_576)),
    plaintext: save('plain-empty.bin', Buffer.alloc(0)),
  },
  {
    name: 'one chunk at the app chunk size',
    file: save('stream-one-chunk.bin', stream(KEY, Buffer.from('hello vault', 'utf8'), 1_048_576)),
    plaintext: save('plain-one-chunk.bin', Buffer.from('hello vault', 'utf8')),
  },
  {
    // The documented limit of the format: there is no end marker, so a stream
    // cut on a chunk boundary reads as a shorter file.
    name: 'last chunk dropped on a chunk boundary (documented limit)',
    file: save('stream-dropped-last-chunk.bin', Buffer.concat([header8, ...records.slice(0, 3)])),
    plaintext: save('plain-first-three-chunks.bin', multi.subarray(0, 192)),
  },
];

const chunkOneCiphertext = 8 + records[0].length + 4 + 12; // first ciphertext byte of chunk 1
const brokenStreams = [
  {
    name: 'tag altered',
    file: save('stream-bad-tag.bin', flip(multiStream, multiStream.length - 1)),
  },
  {
    name: 'ciphertext altered',
    file: save('stream-bad-ciphertext.bin', flip(multiStream, chunkOneCiphertext)),
  },
  {
    name: 'chunks 0 and 1 swapped',
    file: save(
      'stream-reordered.bin',
      Buffer.concat([header8, records[1], records[0], records[2], records[3]]),
    ),
  },
  {
    name: 'cut inside a chunk',
    file: save('stream-truncated.bin', multiStream.subarray(0, multiStream.length - 5)),
  },
  {
    name: 'chunk length past the end of the file',
    file: save(
      'stream-long-length.bin',
      Buffer.concat([header8, be32(10_000), records[0].subarray(4)]),
    ),
  },
  {
    name: 'chunk length shorter than nonce and tag',
    file: save('stream-short-length.bin', Buffer.concat([header8, be32(27), Buffer.alloc(27)])),
  },
];

// --- Pre-2026 single-box files --------------------------------------------------

const legacyApplePlain = Buffer.from('written by the 2025 iOS prototype', 'utf8');
const apple = seal(KEY, legacyApplePlain);
const legacyAndroidPlain = Buffer.from('written by the 2025 Android prototype', 'utf8');
const android = seal(KEY, legacyAndroidPlain);

// --- SVS1 string entry (Android) ----------------------------------------------

const stringPlain = Buffer.from('8f1c0d2e9a7b4c3d', 'utf8');
const stringEntry = seal(KEY, stringPlain);
const legacyStringPlain = Buffer.from('a key from before SVS1', 'utf8');
const legacyString = seal(KEY, legacyStringPlain);

// --- SVB1 backups ---------------------------------------------------------------

const databaseKey = Buffer.from('fixture database key', 'utf8');
const document = pattern(300, 2);
const index = pattern(100, 3);
const goodEntries = [
  { key: '_check', kind: 'c', plain: CHECK_VALUE },
  { key: '_database_key', kind: 's', plain: databaseKey },
  { key: 'doc-1.jpg', kind: 'f', plain: document, chunkSize: 128 },
  { key: 'database', kind: 'x', plain: index },
];
const good = backup(goodEntries);
const lastByte = good.length - 1; // the tag of the last entry's last chunk

const backups = [
  {
    name: 'valid backup',
    file: save('backup.bin', good),
    passphrase: PASSPHRASE,
    expect: 'ok',
    entries: [
      { key: '_database_key', kind: 's', plaintext: save('plain-database-key.bin', databaseKey) },
      { key: 'doc-1.jpg', kind: 'f', plaintext: save('plain-document.bin', document) },
      { key: 'database', kind: 'x', plaintext: save('plain-index.bin', index) },
    ],
  },
  {
    name: 'wrong passphrase',
    file: 'backup.bin',
    passphrase: 'not the passphrase',
    expect: 'passphrase',
  },
  {
    name: 'check entry with another value',
    file: save(
      'backup-bad-check.bin',
      backup([
        { key: '_check', kind: 'c', plain: Buffer.from('something else') },
        ...goodEntries.slice(1),
      ]),
    ),
    passphrase: PASSPHRASE,
    expect: 'passphrase',
  },
  {
    name: 'last payload altered',
    file: save('backup-damaged-last.bin', flip(good, lastByte)),
    passphrase: PASSPHRASE,
    expect: 'corrupt',
  },
  {
    name: 'iteration count no exporter wrote',
    file: save(
      'backup-iterations.bin',
      backup(goodEntries, { kdf: { iterations: 2_000_000_000 } }),
    ),
    passphrase: PASSPHRASE,
    expect: 'unsupported',
  },
  {
    name: 'newer format version',
    file: save('backup-version-2.bin', backup(goodEntries, { header: { version: 2 } })),
    passphrase: PASSPHRASE,
    expect: 'unsupported',
  },
  {
    name: 'other cipher',
    file: save('backup-cipher.bin', backup(goodEntries, { header: { cipher: 'aes-128-gcm' } })),
    passphrase: PASSPHRASE,
    expect: 'unsupported',
  },
  {
    name: 'iteration count as a string',
    file: save(
      'backup-iterations-string.bin',
      backup(goodEntries, { kdf: { iterations: '600000' } }),
    ),
    passphrase: PASSPHRASE,
    expect: 'corrupt',
  },
  {
    name: 'empty salt',
    file: save('backup-empty-salt.bin', backup(goodEntries, { kdf: { salt: '' } })),
    passphrase: PASSPHRASE,
    expect: 'corrupt',
  },
  {
    name: 'trailing byte',
    file: save('backup-trailing.bin', Buffer.concat([good, Buffer.from([0])])),
    passphrase: PASSPHRASE,
    expect: 'corrupt',
  },
  {
    name: 'cut inside the last payload',
    file: save('backup-truncated.bin', good.subarray(0, good.length - 10)),
    passphrase: PASSPHRASE,
    expect: 'corrupt',
  },
  {
    name: 'two entries with one key',
    file: save(
      'backup-duplicate.bin',
      backup([...goodEntries, { key: 'doc-1.jpg', kind: 'f', plain: document }]),
    ),
    passphrase: PASSPHRASE,
    expect: 'corrupt',
  },
  {
    name: 'first entry is not the check',
    file: save(
      'backup-no-check.bin',
      backup([goodEntries[1], goodEntries[0], goodEntries[2], goodEntries[3]]),
    ),
    passphrase: PASSPHRASE,
    expect: 'corrupt',
  },
  {
    name: 'unknown entry kind',
    file: save(
      'backup-unknown-kind.bin',
      backup([...goodEntries.slice(0, 3), { key: 'database', kind: 'z', plain: index }]),
    ),
    passphrase: PASSPHRASE,
    expect: 'corrupt',
  },
  {
    name: 'fewer entries than the smallest backup',
    file: save('backup-too-few.bin', backup(goodEntries.slice(0, 2))),
    passphrase: PASSPHRASE,
    expect: 'corrupt',
  },
  {
    name: 'not a backup',
    file: save('backup-not-svb1.bin', Buffer.from('PK\u0003\u0004 a zip file')),
    passphrase: PASSPHRASE,
    expect: 'corrupt',
  },
];

const vectors = {
  comment: 'Generated by make-fixtures.mjs. Do not edit; run the script instead.',
  key: KEY.toString('hex'),
  streams,
  brokenStreams,
  legacyApple: {
    name: 'single CryptoKit sealed box (nonce, ciphertext, tag)',
    file: save('legacy-apple.bin', Buffer.concat([apple.nonce, apple.sealed])),
    plaintext: save('plain-legacy-apple.bin', legacyApplePlain),
  },
  legacyAndroid: {
    name: 'ciphertext and tag, nonce kept elsewhere',
    file: save('legacy-android.bin', android.sealed),
    nonce: android.nonce.toString('hex'),
    plaintext: save('plain-legacy-android.bin', legacyAndroidPlain),
  },
  stringEntry: {
    name: 'SVS1 string entry',
    file: save(
      'string-entry.bin',
      Buffer.concat([Buffer.from('SVS1'), stringEntry.nonce, stringEntry.sealed]),
    ),
    plaintext: save('plain-string-entry.bin', stringPlain),
  },
  legacyStringEntry: {
    name: 'string entry from before SVS1, nonce kept in preferences',
    file: save('string-entry-legacy.bin', legacyString.sealed),
    nonce: legacyString.nonce.toString('hex'),
    plaintext: save('plain-string-entry-legacy.bin', legacyStringPlain),
  },
  backups,
};

writeFileSync(join(out, 'vectors.json'), `${JSON.stringify(vectors, null, 2)}\n`);
console.warn(`Wrote ${files.size + 1} files to ${out}`);
