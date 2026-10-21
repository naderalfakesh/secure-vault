import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import { findHardcodedStrings } from '@/testing/hardcodedStrings';

const ROOT = join(__dirname, '..', '..', '..');

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return ['__tests__', 'i18n', 'testing'].includes(name) ? [] : sources(path);
    }
    const source = /\.tsx?$/.test(name) && !name.endsWith('.d.ts');
    return source && !/\.(test|jest|mock)\.tsx?$/.test(name) ? [path] : [];
  });
}

const caught = (code: string, name = 'sample.tsx') => findHardcodedStrings(name, code).length > 0;

describe('string table coverage', () => {
  it('recognises every form a hard-coded string takes', () => {
    expect(caught('const a = <Text variant="body">Your vault is empty</Text>;')).toBe(true);
    expect(caught('const a = (\n  <Text>\n    Your vault\n    is empty\n  </Text>\n);')).toBe(true);
    expect(caught('const a = <Text>Hi {name}</Text>;')).toBe(true);
    expect(caught("const a = <Text>{'Continue'}</Text>;")).toBe(true);
    expect(caught("const a = <Text>{busy ? 'Saving…' : t('common.done')}</Text>;")).toBe(true);
    expect(caught('const a = <IconButton icon="close" accessibilityLabel="Close" />;')).toBe(true);
    expect(caught("const a = <Button label={open ? 'Hide' : 'Show'} />;")).toBe(true);
    expect(caught("toast.show({ message: 'Moved', tone: 'success' });")).toBe(true);
    expect(caught('toast.show({ message: `Moved ${count}` });')).toBe(true);
    expect(caught("export const COPY = { lead: 'Locked while sharing' };", 'copy.ts')).toBe(true);
    expect(caught("export const BODY = 'Too many wrong PINs.';", 'copy.ts')).toBe(true);
    expect(caught("const label = ready ? 'Done' : 'Saving now';", 'copy.ts')).toBe(true);
  });

  it('leaves keys, identifiers, errors and marked data alone', () => {
    expect(caught('const a = <Button label={t(\'common.continue\')} variant="plain" />;')).toBe(
      false,
    );
    expect(caught('const a = <Text variant="pinDigit">{displayDigit(key)}</Text>;')).toBe(false);
    expect(caught("const a = <Icon name={on ? 'eyeOff' : 'eye'} />;")).toBe(false);
    expect(caught("throw new Error('The stored key is malformed.');", 'a.ts')).toBe(false);
    expect(caught("console.error('Failed to load documents:', e);", 'a.ts')).toBe(false);
    expect(caught("const sql = 'SELECT id FROM documents WHERE id = ?';", 'a.ts')).toBe(false);
    expect(caught("const x = 'Untitled document'; // i18n-ignore: stored data", 'a.ts')).toBe(
      false,
    );
  });

  it('leaves no user-facing literal in a screen, component or copy module', () => {
    const offenders = [join(ROOT, 'app'), join(ROOT, 'src')]
      .flatMap(sources)
      .flatMap((file) => findHardcodedStrings(relative(ROOT, file), readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
