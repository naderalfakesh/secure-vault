import type { PickedFile } from '@/types';

import { photoName, scanPageName, thumbnailsFor, withoutPage } from '../helpers';

const page = (uri: string): PickedFile => ({ uri, name: `${uri}.jpg`, type: 'image/jpeg' });

describe('add document helpers', () => {
  it('numbers scanned pages from 1', () => {
    expect(scanPageName(0, 1700)).toBe('scan-1700-1.jpg');
    expect(scanPageName(2, 1700)).toBe('scan-1700-3.jpg');
  });

  it('keeps a photo’s own name and names one without', () => {
    expect(photoName('IMG_0001.HEIC', 1700)).toBe('IMG_0001.HEIC');
    expect(photoName(null, 1700)).toBe('scan-1700.jpg');
    expect(photoName(undefined, 1700)).toBe('scan-1700.jpg');
  });

  it('shows a scan’s pages and a single pick’s preview', () => {
    const files = [page('a'), page('b')];
    expect(thumbnailsFor('scan', files, 'a')).toEqual(['a', 'b']);
    expect(thumbnailsFor('single', files, 'preview')).toEqual(['preview']);
    expect(thumbnailsFor('single', files, null)).toEqual([]);
  });

  it('removes one page by position', () => {
    const files = [page('a'), page('b'), page('c')];
    expect(withoutPage(files, 1).map((file) => file.uri)).toEqual(['a', 'c']);
    expect(withoutPage(files, 5)).toEqual(files);
  });
});
