const SEPARATOR = ',';

export function parseTags(text: string): string[] {
  return text
    .split(SEPARATOR)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatTags(tags: readonly string[]): string {
  return tags.join(`${SEPARATOR} `);
}
