import { isCancellable } from '../ProcessingPanel';
import { pageActions } from '../ReviewPages/pageActions';
import { sourceRows } from '../SourceList';

const names = (actions: { name: string }[]) => actions.map((action) => action.name);
const keys = (rows: { key: string; disabled?: boolean }[]) =>
  rows.map((row) => (row.disabled ? `${row.key}:off` : row.key));

describe('isCancellable', () => {
  it('allows cancelling only before encrypting starts', () => {
    expect(isCancellable('ocr')).toBe(true);
    expect(isCancellable('suggest')).toBe(true);
    expect(isCancellable('encrypt')).toBe(false);
    expect(isCancellable('index')).toBe(false);
  });
});

describe('pageActions', () => {
  it('offers no move past either end', () => {
    expect(names(pageActions(0, 3))).toEqual(['moveLater', 'remove']);
    expect(names(pageActions(1, 3))).toEqual(['moveEarlier', 'moveLater', 'remove']);
    expect(names(pageActions(2, 3))).toEqual(['moveEarlier', 'remove']);
    expect(names(pageActions(0, 1))).toEqual(['remove']);
  });
});

describe('sourceRows', () => {
  it('offers the scanner and the camera when both work', () => {
    expect(keys(sourceRows(true, true, false))).toEqual(['scan', 'camera', 'library', 'files']);
  });

  it('offers only the photo row without the scanner', () => {
    expect(keys(sourceRows(false, true, false))).toEqual(['camera', 'library', 'files']);
  });

  it('disables both camera rows without a camera', () => {
    expect(keys(sourceRows(true, false, false))).toEqual([
      'scan:off',
      'camera:off',
      'library',
      'files',
    ]);
  });

  it('drops the camera rows once access is refused', () => {
    expect(keys(sourceRows(true, true, true))).toEqual(['library', 'files']);
  });
});
