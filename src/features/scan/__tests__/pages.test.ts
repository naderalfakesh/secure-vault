import { isolate } from '@/utils/bidi';

import {
  importKind,
  importMimeType,
  mimeTypeFor,
  movePage,
  stripExtension,
  suggestedTitleFor,
} from '../pages';
import {
  foundFieldLabel,
  pageCount,
  pagePosition,
  scanText,
  unsupportedFileMessage,
} from '../scanCopy';

describe('importKind', () => {
  it('accepts PDFs and JPEG, PNG and HEIC images by their reported type', () => {
    expect(importKind('lease.pdf', 'application/pdf')).toBe('pdf');
    expect(importKind('a.jpg', 'image/jpeg')).toBe('image');
    expect(importKind('a.png', 'image/png')).toBe('image');
    expect(importKind('a.heic', 'image/heic')).toBe('image');
    expect(importKind('a.heif', 'IMAGE/HEIF')).toBe('image');
  });

  it('refuses every other type, even with a friendly extension', () => {
    expect(importKind('budget-final.numbers', 'application/x-iwork-numbers-sffnumbers')).toBeNull();
    expect(importKind('scan.gif', 'image/gif')).toBeNull();
    expect(importKind('notes.pdf', 'text/plain')).toBeNull();
  });

  it('falls back to the extension only when no type is reported', () => {
    expect(importKind('Lease.PDF', undefined)).toBe('pdf');
    expect(importKind('photo.jpeg', null)).toBe('image');
    expect(importKind('budget.numbers', '')).toBeNull();
    expect(importKind('README', undefined)).toBeNull();
  });

  it('uses the extension when the reported type is only a generic binary type', () => {
    expect(importKind('scan.heic', 'application/octet-stream')).toBe('image');
    expect(importKind('x.pdf', 'application/octet-stream')).toBe('pdf');
    expect(importKind('x.PDF', 'binary/octet-stream')).toBe('pdf');
    expect(importKind('budget.numbers', 'application/octet-stream')).toBeNull();
    expect(importMimeType('scan.heic', 'application/octet-stream', 'image')).toBe('image/heic');
    expect(importMimeType('x.pdf', 'application/octet-stream', 'pdf')).toBe('application/pdf');
    expect(importMimeType('a.jpg', 'image/jpeg', 'image')).toBe('image/jpeg');
    expect(importMimeType('a.png', undefined, 'image')).toBe('image/png');
  });

  it('names a type for files the picker did not type', () => {
    expect(mimeTypeFor('a.pdf', 'pdf')).toBe('application/pdf');
    expect(mimeTypeFor('a.PNG', 'image')).toBe('image/png');
    expect(mimeTypeFor('a.heic', 'image')).toBe('image/heic');
    expect(mimeTypeFor('a.jpg', 'image')).toBe('image/jpeg');
  });
});

describe('movePage', () => {
  it('moves a page one place either way and ignores the ends', () => {
    expect(movePage(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(movePage(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(movePage(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(movePage(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    expect(movePage(['a'], 5, 1)).toEqual(['a']);
  });

  it('never changes the list it was given', () => {
    const pages = ['a', 'b'];
    movePage(pages, 0, 1);
    expect(pages).toEqual(['a', 'b']);
  });
});

describe('scan copy', () => {
  it('isolates the file name in the unsupported-file sentence', () => {
    const name = 'عقد الإيجار 2026.numbers';
    expect(unsupportedFileMessage(name)).toBe(
      `${isolate(name)} can’t be added. Choose a PDF or an image (JPEG, PNG, HEIC).`,
    );
  });

  it('keeps the size-limit sentence reserved and unfilled (D9)', () => {
    expect(scanText('import.tooLarge')).toContain('[LIMIT]');
  });

  it('counts and places pages', () => {
    expect(pageCount(1)).toBe('1 page');
    expect(pageCount(3)).toBe('3 pages');
    expect(pagePosition(0, 3, false)).toBe('Page 1 of 3');
    expect(pagePosition(1, 3, true)).toBe('Page 2 of 3, moving');
  });

  it('masks found numbers and formats found dates', () => {
    const date = (iso: string) => `D(${iso})`;
    expect(foundFieldLabel({ key: 'number', value: 'X12344821', kind: 'text' }, date)).toBe(
      'No. •••• 4821',
    );
    expect(foundFieldLabel({ key: 'expires', value: '2027-01-03', kind: 'date' }, date)).toBe(
      'Expires D(2027-01-03)',
    );
  });

  it('starts a photo whose only name is a media id with a neutral dated title', () => {
    const day = new Date('2026-10-23T09:00:00Z');
    const neutral = suggestedTitleFor('7233', day);
    expect(neutral).toMatch(/^Photo \S.*2026$/);
    for (const name of [
      '7233.jpg',
      '1000012345',
      'image:7233',
      'msf:1000012345',
      'content://media/external/images/media/7233',
      '8F0C2A41-6B3D-4E8A-9F11-2C7D5E0B9A13.jpg',
      'scan-1729680000000.jpg',
      '',
      null,
      undefined,
    ]) {
      expect(suggestedTitleFor(name, day)).toBe(neutral);
    }
  });

  it('keeps a real name as the title, without its extension', () => {
    expect(suggestedTitleFor('IMG_2041.HEIC')).toBe('IMG_2041');
    expect(suggestedTitleFor('Passport scan 2026.jpg')).toBe('Passport scan 2026');
    expect(suggestedTitleFor('2026 tax return.pdf')).toBe('2026 tax return');
  });

  it('strips one extension from a file name', () => {
    expect(stripExtension('lease.final.pdf')).toBe('lease.final');
    expect(stripExtension('README')).toBe('README');
  });
});
