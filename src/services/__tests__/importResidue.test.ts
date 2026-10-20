import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { closeDocumentStore } from '@/data/database';

import vault from '../../../modules/expo-vault';
import {
  APPLE_INBOX_DIRECTORY,
  documentService,
  IMAGE_PICKER_DIRECTORY,
  SCANNER_DIRECTORY,
} from '../DocumentService';

const vaultMock = vault as unknown as { reset(): void };

// The mock file system has no app container; give it the iOS layout so the
// app's tmp folder is a sibling of Documents, as on a device.
const container = 'file:///mock/';
const tmp = () => new Directory(`${container}tmp/`);

function plant(directory: Directory, name: string): File {
  if (!directory.exists) directory.create({ intermediates: true });
  const file = new File(directory, name);
  file.write('plaintext');
  return file;
}

function removeQuietly(entry: File | Directory) {
  if (entry.exists) entry.delete();
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
      documentService.discardPickedCopy(`${tmp().uri}%2E%2E/Documents/${scanPage}`);

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
      documentService.discardPickedCopy(`${imagePicker().uri}%2E%2E/own.jpg`);
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
});
