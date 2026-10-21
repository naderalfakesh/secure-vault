import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return ['__tests__', 'i18n', 'testing'].includes(name) ? [] : sources(path);
    }
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

const TEXT_PROPS =
  'accessibilityLabel|accessibilityHint|label|loadingLabel|title|subtitle|message|placeholder|actionLabel|secondaryActionLabel|scanLabel|biometricLabel|value|detail|meta|body|hint';

/** JSX text such as `<Text>Cancel</Text>`, and text props written as a literal. */
const PATTERNS = [
  /<Text\b[^>]*>\s*[A-Za-z][^<{]*</,
  new RegExp(`\\b(?:${TEXT_PROPS})=["'][^"']*[A-Za-z]{2}[^"']*["']`),
  new RegExp(`\\b(?:${TEXT_PROPS})=\\{\\s*['\`][A-Z][^'\`]*['\`]\\s*\\}`),
];

describe('string table coverage', () => {
  it('recognises a hard-coded string when it sees one', () => {
    const caught = (line: string) => PATTERNS.some((pattern) => pattern.test(line));
    expect(caught('<Text variant="body">Your vault is empty</Text>')).toBe(true);
    expect(caught('<IconButton icon="close" accessibilityLabel="Close" />')).toBe(true);
    expect(caught("<Button label={'Continue'} />")).toBe(true);
    expect(caught("<Button label={t('common.continue')} />")).toBe(false);
    expect(caught('<Text variant="pinDigit">{displayDigit(key)}</Text>')).toBe(false);
  });

  it('leaves no user-facing literal in a screen or component', () => {
    const offenders = [join(ROOT, 'app'), join(ROOT, 'src')].flatMap(sources).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .filter(({ line }) => PATTERNS.some((pattern) => pattern.test(line)))
        .map(({ line, index }) => `${relative(ROOT, file)}:${index + 1}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
