const SEPARATOR = ',';

/** Comma-separated tags as a list, blanks dropped. */
export function parseTags(text: string): string[] {
  return text
    .split(SEPARATOR)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** The text a tags field shows for a list of tags; `parseTags` reads it back. */
export function formatTags(tags: readonly string[]): string {
  return tags.join(`${SEPARATOR} `);
}
