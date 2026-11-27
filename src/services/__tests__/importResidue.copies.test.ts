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

import { documentService, IMAGE_PICKER_DIRECTORY, SCANNER_DIRECTORY } from '../DocumentService';

describe('import copies outside the vault (picker, scanner and content://)', () => {
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

  describe('photo picker and scanner copies', () => {
    const imagePicker = () => new Directory(Paths.cache, IMAGE_PICKER_DIRECTORY);
    const scanner = () => new Directory(Paths.cache, SCANNER_DIRECTORY);
    const scanPage = 'scan_5A1E9C70-0D2B-4F6E-8C3A-7B4D1E2F3A90_0.jpg';

    it('removes the photo picker and Android scanner copies once they are in the vault', async () => {
      const photo = plantPlaintext(imagePicker(), '8F0C2A41-6B3D-4E8A-9F11-2C7D5E0B9A13.jpg');
      const page1 = plantPlaintext(scanner(), '1234567890.jpg');
      const page2 = plantPlaintext(scanner(), '1234567891.jpg');

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
      const page = plantPlaintext(mockTmp(), scanPage);
      const other = plantPlaintext(mockTmp(), 'scan_notes.jpg');
      const lower = plantPlaintext(mockTmp(), scanPage.toLowerCase());

      await documentService.addDocument(
        { uri: page.uri, name: 'scan-1.jpg', type: 'image/jpeg' },
        { title: 'Scan' },
      );
      documentService.discardPickedCopy(other.uri);
      documentService.discardPickedCopy(lower.uri);
      expectRefused(() =>
        documentService.discardPickedCopy(`${mockTmp().uri}%2E%2E/Documents/${scanPage}`),
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
      const page = plantPlaintext(new Directory('file:///private/var/app/tmp/'), scanPage);
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
      const page = plantPlaintext(mockTmp(), scanPage);

      documentService.discardPickedCopy(page.uri);

      expect(page.exists).toBe(true);
    });

    it('never removes a file beside or below those folders', () => {
      const lookalike = plantPlaintext(
        new Directory(Paths.cache, `${IMAGE_PICKER_DIRECTORY}-other`),
        'a.jpg',
      );
      const nested = plantPlaintext(new Directory(imagePicker(), 'nested'), 'b.jpg');
      const own = plantPlaintext(new Directory(Paths.cache), 'own.jpg');

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
      const photo = plantPlaintext(imagePicker(), 'C0FFEE00-0000-4000-8000-000000000001.jpg');
      const page = plantPlaintext(scanner(), '42.jpg');
      const iosPage = plantPlaintext(mockTmp(), scanPage);
      const lookalike = plantPlaintext(
        new Directory(Paths.cache, `${IMAGE_PICKER_DIRECTORY}-other`),
        'a.jpg',
      );
      const unrelated = plantPlaintext(mockTmp(), 'notes.txt');

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
      const providerDir = new Directory(provider);
      if (!providerDir.exists) providerDir.create({ intermediates: true });
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
      const copy = plantPlaintext(new Directory(Paths.cache), 'temp_import_1760000000000');
      const kept = [
        plantPlaintext(new Directory(Paths.cache), 'temp_import_x'),
        plantPlaintext(new Directory(Paths.cache), 'temp_import_1760000000000.pdf'),
        plantPlaintext(new Directory(Paths.cache), 'temp_notes'),
      ];

      await documentService.clearCache();

      expect(copy.exists).toBe(false);
      expect(kept.map((file) => file.exists)).toEqual([true, true, true]);
      for (const file of kept) removeQuietly(file);
    });
  });
});
