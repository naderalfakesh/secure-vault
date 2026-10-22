import { Directory, File, Paths } from 'expo-file-system';

import { isEncryptedPdf } from '../pdfPassword';

const folder = new Directory(Paths.cache, 'pdf-password-test');

function pdf(name: string, text: string): string {
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, name);
  file.create({ overwrite: true });
  file.write(text);
  return file.uri;
}

const filler = (length: number) => 'x'.repeat(length);

afterEach(() => {
  if (folder.exists) folder.delete();
});

describe('isEncryptedPdf', () => {
  it('finds the encryption entry in a small trailer', async () => {
    const uri = pdf(
      'small.pdf',
      '%PDF-1.7\n1 0 obj<<>>endobj\ntrailer\n<</Root 1 0 R/Encrypt 5 0 R/Size 6>>\n%%EOF',
    );
    await expect(isEncryptedPdf(uri)).resolves.toBe(true);
  });

  it('finds it at the end of a large file and at the start of a linearised one', async () => {
    const tail = pdf(
      'tail.pdf',
      `%PDF-1.7\n${filler(200_000)}trailer<</Encrypt<</Filter/Standard>>>>`,
    );
    const head = pdf('head.pdf', `%PDF-1.7\n<</Linearized 1>><</Encrypt 9 0 R>>${filler(200_000)}`);
    await expect(isEncryptedPdf(tail)).resolves.toBe(true);
    await expect(isEncryptedPdf(head)).resolves.toBe(true);
  });

  it('answers false for a damaged or plain PDF and for a missing file', async () => {
    const plain = pdf('plain.pdf', `%PDF-1.4\n${filler(200_000)}trailer<</Root 1 0 R>>%%EOF`);
    const damaged = pdf('damaged.pdf', 'plaintext');
    await expect(isEncryptedPdf(plain)).resolves.toBe(false);
    await expect(isEncryptedPdf(damaged)).resolves.toBe(false);
    await expect(isEncryptedPdf(`${folder.uri}missing.pdf`)).resolves.toBe(false);
  });

  it('does not take a longer name that starts with Encrypt for the entry', async () => {
    const uri = pdf('other.pdf', '%PDF-1.7\n<</EncryptMetadata false>>');
    await expect(isEncryptedPdf(uri)).resolves.toBe(false);
  });
});
