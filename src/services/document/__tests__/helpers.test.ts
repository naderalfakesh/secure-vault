import {
  cacheLocation,
  canonicalPath,
  childName,
  comparablePath,
  expiryCutoff,
  isCachePath,
  isClearableCacheEntry,
  renamedCopyPattern,
  shareFileName,
  toPath,
  toUri,
} from '../helpers';

describe('paths and URIs', () => {
  it('converts between file URIs and paths both ways', () => {
    expect(toPath('file:///var/cache/a.jpg')).toBe('/var/cache/a.jpg');
    expect(toPath('/var/cache/a.jpg')).toBe('/var/cache/a.jpg');
    expect(toUri('/var/cache/a.jpg')).toBe('file:///var/cache/a.jpg');
    expect(toUri('file:///var/cache/a.jpg')).toBe('file:///var/cache/a.jpg');
  });

  it('folds the iOS /private alias and decodes for comparisons', () => {
    expect(canonicalPath('/private/var/app/tmp/x')).toBe('/var/app/tmp/x');
    expect(canonicalPath('/private/etc/x')).toBe('/private/etc/x');
    expect(comparablePath('file:///private/var/app/a%20b.pdf')).toBe('/var/app/a b.pdf');
  });

  it('names only an entry directly inside the folder', () => {
    expect(childName('/cache/DocumentPicker/a.pdf', '/cache/DocumentPicker')).toBe('a.pdf');
    expect(childName('/cache/DocumentPicker/a.pdf', '/cache/DocumentPicker/')).toBe('a.pdf');
    expect(childName('/cache/DocumentPicker/sub/a.pdf', '/cache/DocumentPicker')).toBeNull();
    expect(childName('/cache/DocumentPicker/..', '/cache/DocumentPicker')).toBeNull();
    expect(childName('/cache/DocumentPicker/', '/cache/DocumentPicker')).toBeNull();
    expect(childName('/cache/Other/a.pdf', '/cache/DocumentPicker')).toBeNull();
  });

  it('places a file in the cache and recognises cache paths', () => {
    expect(cacheLocation('file:///cache/', 'thumb_1.jpg')).toEqual({
      uri: 'file:///cache/thumb_1.jpg',
      path: '/cache/thumb_1.jpg',
    });
    expect(isCachePath('file:///cache/', '/cache/undo_1.jpg')).toBe(true);
    expect(isCachePath('file:///cache/', '/documents/undo_1.jpg')).toBe(false);
  });
});

describe('renamedCopyPattern', () => {
  it('matches the names iOS gives a second copy, and nothing else', () => {
    const pattern = renamedCopyPattern('scan (1).pdf');
    expect(pattern.test('scan (1) 2.pdf')).toBe(true);
    expect(pattern.test('scan (1)-3.pdf')).toBe(true);
    expect(pattern.test('scan (1).pdf')).toBe(false);
    expect(pattern.test('scan (1) 2.pdfx')).toBe(false);
    expect(renamedCopyPattern('README').test('README 2')).toBe(true);
  });
});

describe('isClearableCacheEntry', () => {
  it('clears decrypted and imported scratch, and keeps everything else', () => {
    for (const name of [
      'decrypted_1.jpg',
      'thumb_1.jpg',
      'temp_import_123',
      'pages_1',
      'undo_1.pdf',
      'share',
      'expo-sharing-tmp',
      'ImagePicker',
      'mlkit_docscan_ui_client',
      'backup-staging',
    ]) {
      expect(isClearableCacheEntry(name)).toBe(true);
    }
    for (const name of ['DocumentPicker', 'backup', 'temp_import_x', 'restore-staging']) {
      expect(isClearableCacheEntry(name)).toBe(false);
    }
  });
});

describe('expiryCutoff', () => {
  it('gives the UTC date the window ends on', () => {
    const now = Date.UTC(2026, 0, 30, 23, 0);
    expect(expiryCutoff(0, now)).toBe('2026-01-30');
    expect(expiryCutoff(2, now)).toBe('2026-02-01');
  });
});

describe('shareFileName', () => {
  it('keeps a readable name without path characters', () => {
    expect(shareFileName('Passport (2026)')).toBe('Passport (2026)');
    expect(shareFileName(' a/b:c  d ')).toBe('a b c d');
    expect(shareFileName('///')).toBe('document');
  });
});
