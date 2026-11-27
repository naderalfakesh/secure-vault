import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { documentDatabase } from '@/data/database';
import {
  expectRefused,
  mockDocumentsFolder,
  mockTmp,
  plantPlaintext,
  removeQuietly,
} from '@/testing/importResidue';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';
import { followLinksOnDelete } from '@modules/expo-vault/src/ExpoVaultModule.mock';

import {
  APPLE_INBOX_DIRECTORY,
  documentService,
  IMAGE_PICKER_DIRECTORY,
  SCANNER_DIRECTORY,
} from '../DocumentService';

describe('import copies outside the vault (inbox, scratch, previews and symlinks)', () => {
  let documents: jest.SpyInstance;

  beforeEach(async () => {
    vaultMock.reset();
    await documentDatabase.close();
    documents = mockDocumentsFolder();
  });

  afterEach(() => {
    documents.mockRestore();
    jest.replaceProperty(Platform, 'OS', 'ios');
    for (const name of [
      IMAGE_PICKER_DIRECTORY,
      SCANNER_DIRECTORY,
      `${IMAGE_PICKER_DIRECTORY}-other`,
    ]) {
      removeQuietly(new Directory(Paths.cache, name));
    }
    removeQuietly(mockTmp());
  });

  describe("iOS's own copy of a file imported from Files", () => {
    const inbox = () => new Directory(mockTmp(), APPLE_INBOX_DIRECTORY);

    it('is the Inbox folder named after the fixed bundle id', () => {
      expect(APPLE_INBOX_DIRECTORY).toBe('com.naderalfakesh.securevault-Inbox');
    });

    it('removes the copy with the picked name, and only that one', () => {
      const copy = plantPlaintext(inbox(), 'Lease 2026.pdf');
      const other = plantPlaintext(inbox(), 'passport.jpg');

      documentService.discardSystemImportCopy('Lease 2026.pdf');

      expect(copy.exists).toBe(false);
      expect(other.exists).toBe(true);
    });

    it('removes the copy iOS renamed for a duplicate name, and no other file', () => {
      const renamed = plantPlaintext(inbox(), 'scan 2.pdf');
      const hyphenated = plantPlaintext(inbox(), 'scan-3.pdf');
      const kept = [
        plantPlaintext(inbox(), 'scan 2.jpg'),
        plantPlaintext(inbox(), 'scanner 2.pdf'),
        plantPlaintext(inbox(), 'scan 2 copy.pdf'),
        plantPlaintext(inbox(), 'my scan 2.pdf'),
      ];

      documentService.discardSystemImportCopy('scan.pdf');

      expect(renamed.exists).toBe(false);
      expect(hyphenated.exists).toBe(false);
      expect(kept.map((file) => file.exists)).toEqual([true, true, true, true]);
    });

    it('treats regular expression characters in the picked name literally', () => {
      const kept = plantPlaintext(inbox(), 'scanXpdf 2.pdf');

      documentService.discardSystemImportCopy('scan.(pdf).pdf');
      documentService.discardSystemImportCopy('scan.pdf');

      expect(kept.exists).toBe(true);
    });

    it('never removes anything for a name that is not a plain file name', () => {
      const other = plantPlaintext(inbox(), 'passport.jpg');
      const outside = plantPlaintext(mockTmp(), 'notes.txt');
      const nested = plantPlaintext(new Directory(inbox(), 'nested'), 'passport.jpg');

      for (const name of ['', '.', '..', '../notes.txt', 'nested/passport.jpg', 'nested']) {
        documentService.discardSystemImportCopy(name);
      }

      expect(other.exists).toBe(true);
      expect(outside.exists).toBe(true);
      expect(nested.exists).toBe(true);
    });

    it('does nothing on Android, which has no such copy', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      const copy = plantPlaintext(inbox(), 'lease.pdf');

      documentService.discardSystemImportCopy('lease.pdf');

      expect(copy.exists).toBe(true);
    });

    it('does nothing when the container is not laid out as expected', () => {
      documents.mockReturnValue(new Directory('file:///mock/elsewhere/'));
      const copy = plantPlaintext(inbox(), 'lease.pdf');

      documentService.discardSystemImportCopy('lease.pdf');

      expect(copy.exists).toBe(true);
    });

    it('sweeps the Inbox folder at lock and launch, and no other Inbox', async () => {
      const copy = plantPlaintext(inbox(), 'lease.pdf');
      const otherApp = plantPlaintext(new Directory(mockTmp(), 'com.example.other-Inbox'), 'x.pdf');

      await documentService.clearCache();

      expect(copy.exists).toBe(false);
      expect(inbox().exists).toBe(false);
      expect(otherApp.exists).toBe(true);
    });
  });

  describe('scratch files older builds left behind', () => {
    const uuid = '0B7E3D52-1C4A-4B9F-A6E2-8D5F7C9A1B30';

    it('removes the old iOS restore and thumbnail scratch from tmp, and nothing like it', () => {
      const restore = plantPlaintext(mockTmp(), `backup-${uuid}`);
      const thumbnail = plantPlaintext(mockTmp(), uuid);
      const kept = [
        plantPlaintext(mockTmp(), `backup-${uuid.toLowerCase()}`),
        plantPlaintext(mockTmp(), `${uuid}.jpg`),
        plantPlaintext(mockTmp(), 'backup-notes'),
        plantPlaintext(new Directory(mockTmp(), `backup-${uuid}-dir`), uuid),
      ];
      const folder = new Directory(mockTmp(), uuid.replace('0B7E', '1B7E'));
      folder.create();

      documentService.sweepLegacyScratch();

      expect(restore.exists).toBe(false);
      expect(thumbnail.exists).toBe(false);
      expect(kept.map((file) => file.exists)).toEqual([true, true, true, true]);
      expect(folder.exists).toBe(true);
    });

    it('removes the old Android temp files from the cache and vault folders, and nothing like them', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      const cache = new Directory(Paths.cache);
      const files = Paths.document;
      const backup = plantPlaintext(cache, 'backup8237461283746.tmp');
      const vaultTemp = plantPlaintext(files, 'vault5521873465.tmp');
      const kept = [
        plantPlaintext(cache, 'vault123.tmp'),
        plantPlaintext(cache, 'backup.tmp'),
        plantPlaintext(cache, 'backup12.tmp.bak'),
        plantPlaintext(files, 'backup123.tmp'),
        plantPlaintext(files, 'vault.tmp'),
        plantPlaintext(files, 'file_00000000-0000-4000-8000-000000000001'),
        plantPlaintext(new Directory(files, 'SQLite'), 'vault1.tmp'),
        plantPlaintext(mockTmp(), `backup-${uuid}`),
      ];

      documentService.sweepLegacyScratch();

      expect(backup.exists).toBe(false);
      expect(vaultTemp.exists).toBe(false);
      expect(kept.map((file) => file.exists)).toEqual(kept.map(() => true));
      for (const file of kept) removeQuietly(file);
    });
  });

  describe('rendered PDF previews', () => {
    it.each([
      ['fails', () => Promise.reject(new Error('not a pdf'))],
      ['yields no page', () => Promise.resolve([])],
    ])('leaves no empty preview folder when the render %s', async (_case, outcome) => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1760000000123);
      const folder = new Directory(Paths.cache, 'pages_preview_1760000000123');
      const render = jest.spyOn(vault, 'renderPdfPages').mockImplementationOnce(() => {
        // The native renderer makes its folder before it finds the file unreadable.
        folder.create({ intermediates: true, idempotent: true });
        return outcome() as ReturnType<typeof vault.renderPdfPages>;
      });

      await expect(
        documentService.previewForFile('file:///mock/tmp/broken.pdf', 'application/pdf'),
      ).resolves.toBeNull();

      expect(folder.exists).toBe(false);
      render.mockRestore();
      now.mockRestore();
    });

    it('removes the folder a preview was rendered into, and no other', () => {
      const preview = plantPlaintext(
        new Directory(Paths.cache, 'pages_preview_1760000000000'),
        'page_1.jpg',
      );
      const viewer = plantPlaintext(
        new Directory(Paths.cache, 'pages_00000000-0000-4000-8000-1'),
        'page_1.jpg',
      );
      const lookalike = plantPlaintext(new Directory(Paths.cache, 'pages_preview_x'), 'page_1.jpg');
      const loose = plantPlaintext(new Directory(Paths.cache), 'pages_preview_2.jpg');

      documentService.discardPreview(preview.uri);
      documentService.discardPreview(viewer.uri);
      documentService.discardPreview(lookalike.uri);
      documentService.discardPreview(loose.uri);
      expectRefused(() =>
        documentService.discardPreview(
          `${Paths.cache.uri}pages_preview_3/%2E%2E/pages_00000000-0000-4000-8000-1/page_1.jpg`,
        ),
      );
      expectRefused(() =>
        documentService.discardPreview(`${Paths.cache.uri}pages_preview_3/%2E%2E`),
      );
      documentService.discardPreview('file:///mock/document/pages_preview_4/page_1.jpg');

      expect(preview.parentDirectory.exists).toBe(false);
      expect(viewer.exists).toBe(true);
      expect(lookalike.exists).toBe(true);
      expect(loose.exists).toBe(true);
      for (const file of [viewer, lookalike]) removeQuietly(file.parentDirectory);
      removeQuietly(loose);
    });
  });

  describe('folders planted as symbolic links', () => {
    const sentinel = () => new Directory(Paths.document, 'sentinel');
    const toPath = (directory: Directory) =>
      decodeURIComponent(directory.uri.slice('file://'.length));
    let follow: jest.SpyInstance;

    // A link at `link` pointing at a folder of the user's own files.
    const plantLinkedFolder = (link: Directory) => {
      const kept = plantPlaintext(sentinel(), `keep-${link.name}.txt`);
      vaultMock.plantLink(toPath(link), toPath(sentinel()));
      return kept;
    };

    beforeEach(() => {
      follow = followLinksOnDelete();
    });

    afterEach(() => {
      follow.mockRestore();
      removeQuietly(sentinel());
    });

    it('unlinks every swept cache folder at lock and launch without emptying its target', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      const links = [
        IMAGE_PICKER_DIRECTORY,
        SCANNER_DIRECTORY,
        'share',
        'pages_00000000-0000-4000-8000-1',
        'pages_preview_1760000000000',
      ].map((name) => new Directory(Paths.cache, name));
      const kept = links.map(plantLinkedFolder);

      await documentService.clearCache();

      expect(kept.map((file) => file.exists)).toEqual(kept.map(() => true));
      expect(links.map((link) => vaultMock.linkTarget(toPath(link)))).toEqual(
        links.map(() => null),
      );
    });

    it('unlinks a link nested inside a swept folder without emptying its target', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      const share = new Directory(Paths.cache, 'share');
      const copy = plantPlaintext(share, 'Passport.pdf');
      const nested = new Directory(share, 'nested');
      const kept = plantLinkedFolder(nested);

      await documentService.clearCache();

      expect(kept.exists).toBe(true);
      expect(vaultMock.linkTarget(toPath(nested))).toBeNull();
      expect(copy.exists).toBe(false);
      expect(share.exists).toBe(false);
    });

    it('never removes anything outside the cache and tmp', () => {
      const own = plantPlaintext(Paths.document, 'own.txt');

      for (const path of [
        toPath(new Directory(Paths.document, 'own.txt')),
        '/mock/cache',
        '/mock/cache/../Documents/own.txt',
        'mock/cache/share',
      ]) {
        expect(() => vault.removeTreeNoFollow(path)).toThrow(/cannot be removed/);
      }
      expect(own.exists).toBe(true);
      own.delete();
    });

    it("unlinks iOS's Inbox folder at lock and launch without emptying its target", async () => {
      const inbox = new Directory(mockTmp(), APPLE_INBOX_DIRECTORY);
      const kept = plantLinkedFolder(inbox);

      await documentService.clearCache();

      expect(kept.exists).toBe(true);
      expect(vaultMock.linkTarget(toPath(inbox))).toBeNull();
    });

    it('unlinks a preview folder without emptying its target', () => {
      const preview = new Directory(Paths.cache, 'pages_preview_1760000000001');
      const kept = plantLinkedFolder(preview);

      documentService.discardPreview(new File(preview, 'page_1.jpg').uri);

      expect(kept.exists).toBe(true);
      expect(vaultMock.linkTarget(toPath(preview))).toBeNull();
    });
  });
});
