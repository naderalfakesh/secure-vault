import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { closeDocumentStore } from '@/data/database';

import vault from '../../../modules/expo-vault';
import { followLinksOnDelete } from '../../../modules/expo-vault/src/ExpoVaultModule.mock';
import {
  APPLE_INBOX_DIRECTORY,
  documentService,
  IMAGE_PICKER_DIRECTORY,
  SCANNER_DIRECTORY,
} from '../DocumentService';

const vaultMock = vault as unknown as {
  reset(): void;
  plantLink(path: string, target: string): void;
  linkTarget(path: string): string | null;
};

// The mock file system has no app container; give it the iOS layout so the
// app's tmp folder is a sibling of Documents, as on a device.
const container = 'file:///mock/';
const tmp = () => new Directory(`${container}tmp/`);

function plant(directory: Directory, name: string): File {
  if (!directory.exists) directory.create({ intermediates: true });
  const file = new File(directory, name);
  file.writeSync('plaintext');
  return file;
}

function removeQuietly(entry: File | Directory) {
  if (entry.exists) entry.delete();
}

/**
 * The mock file system never resolves `..` or `%2E%2E`, so a traversal input
 * would not reach a real file there anyway; assert the guard refuses it before
 * anything is deleted.
 */
function expectRefused(discard: () => void) {
  const spies = [
    jest.spyOn(File.prototype, 'exists', 'get'),
    jest.spyOn(File.prototype, 'delete'),
    jest.spyOn(Directory.prototype, 'exists', 'get'),
    jest.spyOn(Directory.prototype, 'delete'),
  ];
  try {
    discard();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

describe('import copies outside the vault', () => {
  let documents: jest.SpyInstance;

  beforeEach(async () => {
    vaultMock.reset();
    await closeDocumentStore();
    const documentsFolder = new Directory(`${container}Documents/`);
    if (!documentsFolder.exists) documentsFolder.create({ intermediates: true });
    documents = jest.spyOn(Paths, 'document', 'get').mockReturnValue(documentsFolder);
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
    removeQuietly(tmp());
  });

  describe('photo picker and scanner copies', () => {
    const imagePicker = () => new Directory(Paths.cache, IMAGE_PICKER_DIRECTORY);
    const scanner = () => new Directory(Paths.cache, SCANNER_DIRECTORY);
    const scanPage = 'scan_5A1E9C70-0D2B-4F6E-8C3A-7B4D1E2F3A90_0.jpg';

    it('removes the photo picker and Android scanner copies once they are in the vault', async () => {
      const photo = plant(imagePicker(), '8F0C2A41-6B3D-4E8A-9F11-2C7D5E0B9A13.jpg');
      const page1 = plant(scanner(), '1234567890.jpg');
      const page2 = plant(scanner(), '1234567891.jpg');

      await documentService.addDocument(
        { uri: photo.uri, name: 'passport.jpg', type: 'image/jpeg' },
        { title: 'Passport' },
      );
      await documentService.addDocument(
        [
          { uri: page1.uri, name: 'scan-1.jpg', type: 'image/jpeg' },
          { uri: page2.uri, name: 'scan-2.jpg', type: 'image/jpeg' },
        ],
        { title: 'Lease' },
      );

      expect(photo.exists).toBe(false);
      expect(page1.exists).toBe(false);
      expect(page2.exists).toBe(false);
    });

    it("removes the iOS scanner's pages from tmp, and nothing else there", async () => {
      const page = plant(tmp(), scanPage);
      const other = plant(tmp(), 'scan_notes.jpg');
      const lower = plant(tmp(), scanPage.toLowerCase());

      await documentService.addDocument(
        { uri: page.uri, name: 'scan-1.jpg', type: 'image/jpeg' },
        { title: 'Scan' },
      );
      documentService.discardPickedCopy(other.uri);
      documentService.discardPickedCopy(lower.uri);
      expectRefused(() =>
        documentService.discardPickedCopy(`${tmp().uri}%2E%2E/Documents/${scanPage}`),
      );

      expect(page.exists).toBe(false);
      expect(other.exists).toBe(true);
      expect(lower.exists).toBe(true);
    });

    it('matches a scanner page that iOS reports under the /private alias of /var', () => {
      // On a device tmp comes back as /private/var/..., Documents and Caches as /var/....
      documents.mockReturnValue(new Directory('file:///var/app/Documents/'));
      const caches = jest
        .spyOn(Paths, 'cache', 'get')
        .mockReturnValue(new Directory('file:///var/app/Library/Caches/'));
      const page = plant(new Directory('file:///private/var/app/tmp/'), scanPage);
      try {
        documentService.discardPickedCopy(page.uri);
      } finally {
        caches.mockRestore();
      }
      expect(page.exists).toBe(false);
      removeQuietly(new Directory('file:///private/'));
    });

    it('leaves tmp alone on Android, where the scanner uses its own cache folder', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      const page = plant(tmp(), scanPage);

      documentService.discardPickedCopy(page.uri);

      expect(page.exists).toBe(true);
    });

    it('never removes a file beside or below those folders', () => {
      const lookalike = plant(
        new Directory(Paths.cache, `${IMAGE_PICKER_DIRECTORY}-other`),
        'a.jpg',
      );
      const nested = plant(new Directory(imagePicker(), 'nested'), 'b.jpg');
      const own = plant(new Directory(Paths.cache), 'own.jpg');

      documentService.discardPickedCopy(lookalike.uri);
      documentService.discardPickedCopy(nested.uri);
      expectRefused(() => documentService.discardPickedCopy(`${imagePicker().uri}%2E%2E/own.jpg`));
      expectRefused(() => documentService.discardPickedCopy(`${imagePicker().uri}../own.jpg`));
      documentService.discardPickedCopy(imagePicker().uri);

      expect(lookalike.exists).toBe(true);
      expect(nested.exists).toBe(true);
      expect(own.exists).toBe(true);
      expect(imagePicker().exists).toBe(true);
      own.delete();
    });

    it('sweeps both folders and the iOS scanner pages at lock and launch', async () => {
      const photo = plant(imagePicker(), 'C0FFEE00-0000-4000-8000-000000000001.jpg');
      const page = plant(scanner(), '42.jpg');
      const iosPage = plant(tmp(), scanPage);
      const lookalike = plant(
        new Directory(Paths.cache, `${IMAGE_PICKER_DIRECTORY}-other`),
        'a.jpg',
      );
      const unrelated = plant(tmp(), 'notes.txt');

      await documentService.clearCache();

      expect(photo.exists).toBe(false);
      expect(page.exists).toBe(false);
      expect(imagePicker().exists).toBe(false);
      expect(scanner().exists).toBe(false);
      expect(iosPage.exists).toBe(false);
      expect(lookalike.exists).toBe(true);
      expect(unrelated.exists).toBe(true);
    });
  });

  describe('Android content:// import copies', () => {
    const importCopies = () =>
      new Directory(Paths.cache)
        .list()
        .filter((entry) => entry.name.startsWith('temp_import_'))
        .map((entry) => entry.name);
    const provider = 'content://com.android.providers/document/';
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      // SDK 58's global fetch rejects content:// URIs, so the copy must not go through it.
      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new TypeError('Unsupported scheme: content'));
      const documents = new Directory(provider);
      if (!documents.exists) documents.create({ intermediates: true });
      for (const id of ['1', '2', '3', '4', '5', '6']) {
        new File(provider + id).writeSync(new Uint8Array([37, 80, 68, 70]));
      }
    });

    afterEach(() => {
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
      for (const name of importCopies()) removeQuietly(new File(Paths.cache, name));
    });

    it('hands the vault module a temp_import_ copy of the content:// file', async () => {
      const read: string[] = [];
      const putFile = jest.spyOn(vault, 'putFile').mockImplementation(async (_key, path) => {
        read.push(new File(`file://${path}`).textSync());
      });

      await documentService.addDocument(
        { uri: `${provider}6`, name: 'a.pdf', type: 'application/pdf' },
        { title: 'Lease' },
      );

      expect(putFile.mock.calls[0]?.[1]).toMatch(/\/temp_import_\d+$/);
      expect(read).toEqual(['%PDF']);
      expect(importCopies()).toEqual([]);
      putFile.mockRestore();
    });

    it('gives up on a provider that stalls, and removes the copy once it settles', async () => {
      let finish: () => void = () => {};
      const copy = jest.spyOn(File.prototype, 'copy').mockImplementationOnce(function (
        this: File,
        destination,
      ) {
        new File((destination as File).uri).writeSync('partial');
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      });
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      try {
        const saving = documentService.addDocument(
          { uri: `${provider}1`, name: 'a.jpg', type: 'image/jpeg' },
          { title: 'Lease' },
        );
        const outcome = expect(saving).rejects.toMatchObject({ code: 'IMPORT_COPY_TIMEOUT' });
        await jest.advanceTimersByTimeAsync(8000);
        await outcome;
        expect(importCopies()).toEqual([]);

        // The stalled copy finishes later; what it wrote is removed then too.
        finish();
        await Promise.resolve();
        await Promise.resolve();
        expect(importCopies()).toEqual([]);
      } finally {
        jest.useRealTimers();
        copy.mockRestore();
      }
    });

    it('removes a copy cut short by a failed copy', async () => {
      const copy = jest.spyOn(File.prototype, 'copy').mockImplementationOnce(async function (
        this: File,
        destination,
      ) {
        new File((destination as File).uri).writeSync('partial');
        throw new Error('provider went away');
      });

      await expect(
        documentService.addDocument(
          { uri: `${provider}1`, name: 'a.jpg', type: 'image/jpeg' },
          { title: 'Lease' },
        ),
      ).rejects.toThrow('provider went away');

      expect(importCopies()).toEqual([]);
      copy.mockRestore();
    });

    it('removes the plaintext copy once the document is in the vault', async () => {
      await documentService.addDocument(
        [
          { uri: 'content://com.android.providers/document/1', name: 'a.jpg', type: 'image/jpeg' },
          { uri: 'content://com.android.providers/document/2', name: 'b.jpg', type: 'image/jpeg' },
        ],
        { title: 'Lease' },
      );

      expect(importCopies()).toEqual([]);
    });

    it('removes the plaintext copy when the vault module refuses it', async () => {
      const putFile = jest.spyOn(vault, 'putFile').mockRejectedValueOnce(new Error('disk full'));

      await expect(
        documentService.addDocument(
          {
            uri: 'content://com.android.providers/document/3',
            name: 'a.pdf',
            type: 'application/pdf',
          },
          { title: 'Lease' },
        ),
      ).rejects.toThrow('disk full');

      expect(importCopies()).toEqual([]);
      putFile.mockRestore();
    });

    it('removes the plaintext copy a PDF preview was rendered from, also when rendering fails', async () => {
      const preview = await documentService.previewForFile(
        'content://com.android.providers/document/4',
        'application/pdf',
      );
      expect(preview).toMatch(/pages_preview_\d+\/page_1\.jpg$/);
      expect(importCopies()).toEqual([]);

      const render = jest
        .spyOn(vault, 'renderPdfPages')
        .mockRejectedValueOnce(new Error('not a pdf'));
      await expect(
        documentService.previewForFile(
          'content://com.android.providers/document/5',
          'application/pdf',
        ),
      ).resolves.toBeNull();
      expect(importCopies()).toEqual([]);
      render.mockRestore();
      if (preview) documentService.discardPreview(preview);
    });

    it('sweeps a copy a kill left behind at lock and launch, by its exact name only', async () => {
      const copy = plant(new Directory(Paths.cache), 'temp_import_1760000000000');
      const kept = [
        plant(new Directory(Paths.cache), 'temp_import_x'),
        plant(new Directory(Paths.cache), 'temp_import_1760000000000.pdf'),
        plant(new Directory(Paths.cache), 'temp_notes'),
      ];

      await documentService.clearCache();

      expect(copy.exists).toBe(false);
      expect(kept.map((file) => file.exists)).toEqual([true, true, true]);
      for (const file of kept) removeQuietly(file);
    });
  });

  describe("iOS's own copy of a file imported from Files", () => {
    const inbox = () => new Directory(tmp(), APPLE_INBOX_DIRECTORY);

    it('is the Inbox folder named after the fixed bundle id', () => {
      expect(APPLE_INBOX_DIRECTORY).toBe('com.naderalfakesh.securevault-Inbox');
    });

    it('removes the copy with the picked name, and only that one', () => {
      const copy = plant(inbox(), 'Lease 2026.pdf');
      const other = plant(inbox(), 'passport.jpg');

      documentService.discardSystemImportCopy('Lease 2026.pdf');

      expect(copy.exists).toBe(false);
      expect(other.exists).toBe(true);
    });

    it('removes the copy iOS renamed for a duplicate name, and no other file', () => {
      const renamed = plant(inbox(), 'scan 2.pdf');
      const hyphenated = plant(inbox(), 'scan-3.pdf');
      const kept = [
        plant(inbox(), 'scan 2.jpg'),
        plant(inbox(), 'scanner 2.pdf'),
        plant(inbox(), 'scan 2 copy.pdf'),
        plant(inbox(), 'my scan 2.pdf'),
      ];

      documentService.discardSystemImportCopy('scan.pdf');

      expect(renamed.exists).toBe(false);
      expect(hyphenated.exists).toBe(false);
      expect(kept.map((file) => file.exists)).toEqual([true, true, true, true]);
    });

    it('treats regular expression characters in the picked name literally', () => {
      const kept = plant(inbox(), 'scanXpdf 2.pdf');

      documentService.discardSystemImportCopy('scan.(pdf).pdf');
      documentService.discardSystemImportCopy('scan.pdf');

      expect(kept.exists).toBe(true);
    });

    it('never removes anything for a name that is not a plain file name', () => {
      const other = plant(inbox(), 'passport.jpg');
      const outside = plant(tmp(), 'notes.txt');
      const nested = plant(new Directory(inbox(), 'nested'), 'passport.jpg');

      for (const name of ['', '.', '..', '../notes.txt', 'nested/passport.jpg', 'nested']) {
        documentService.discardSystemImportCopy(name);
      }

      expect(other.exists).toBe(true);
      expect(outside.exists).toBe(true);
      expect(nested.exists).toBe(true);
    });

    it('does nothing on Android, which has no such copy', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      const copy = plant(inbox(), 'lease.pdf');

      documentService.discardSystemImportCopy('lease.pdf');

      expect(copy.exists).toBe(true);
    });

    it('does nothing when the container is not laid out as expected', () => {
      documents.mockReturnValue(new Directory('file:///mock/elsewhere/'));
      const copy = plant(inbox(), 'lease.pdf');

      documentService.discardSystemImportCopy('lease.pdf');

      expect(copy.exists).toBe(true);
    });

    it('sweeps the Inbox folder at lock and launch, and no other Inbox', async () => {
      const copy = plant(inbox(), 'lease.pdf');
      const otherApp = plant(new Directory(tmp(), 'com.example.other-Inbox'), 'x.pdf');

      await documentService.clearCache();

      expect(copy.exists).toBe(false);
      expect(inbox().exists).toBe(false);
      expect(otherApp.exists).toBe(true);
    });
  });

  describe('scratch files older builds left behind', () => {
    const uuid = '0B7E3D52-1C4A-4B9F-A6E2-8D5F7C9A1B30';

    it('removes the old iOS restore and thumbnail scratch from tmp, and nothing like it', () => {
      const restore = plant(tmp(), `backup-${uuid}`);
      const thumbnail = plant(tmp(), uuid);
      const kept = [
        plant(tmp(), `backup-${uuid.toLowerCase()}`),
        plant(tmp(), `${uuid}.jpg`),
        plant(tmp(), 'backup-notes'),
        plant(new Directory(tmp(), `backup-${uuid}-dir`), uuid),
      ];
      const folder = new Directory(tmp(), uuid.replace('0B7E', '1B7E'));
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
      const backup = plant(cache, 'backup8237461283746.tmp');
      const vaultTemp = plant(files, 'vault5521873465.tmp');
      const kept = [
        plant(cache, 'vault123.tmp'),
        plant(cache, 'backup.tmp'),
        plant(cache, 'backup12.tmp.bak'),
        plant(files, 'backup123.tmp'),
        plant(files, 'vault.tmp'),
        plant(files, 'file_00000000-0000-4000-8000-000000000001'),
        plant(new Directory(files, 'SQLite'), 'vault1.tmp'),
        plant(tmp(), `backup-${uuid}`),
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
      const preview = plant(
        new Directory(Paths.cache, 'pages_preview_1760000000000'),
        'page_1.jpg',
      );
      const viewer = plant(
        new Directory(Paths.cache, 'pages_00000000-0000-4000-8000-1'),
        'page_1.jpg',
      );
      const lookalike = plant(new Directory(Paths.cache, 'pages_preview_x'), 'page_1.jpg');
      const loose = plant(new Directory(Paths.cache), 'pages_preview_2.jpg');

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
      const kept = plant(sentinel(), `keep-${link.name}.txt`);
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
      const copy = plant(share, 'Passport.pdf');
      const nested = new Directory(share, 'nested');
      const kept = plantLinkedFolder(nested);

      await documentService.clearCache();

      expect(kept.exists).toBe(true);
      expect(vaultMock.linkTarget(toPath(nested))).toBeNull();
      expect(copy.exists).toBe(false);
      expect(share.exists).toBe(false);
    });

    it('never removes anything outside the cache and tmp', () => {
      const own = plant(Paths.document, 'own.txt');

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
      const inbox = new Directory(tmp(), APPLE_INBOX_DIRECTORY);
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
