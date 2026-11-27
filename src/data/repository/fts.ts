// Quote each term as an FTS5 prefix match so user input cannot alter query syntax.
export function toFtsQuery(input: string): string {
  return input
    .split(/\s+/)
    .map((term) => term.replace(/["*]/g, '').trim())
    .filter(Boolean)
    .map((term) => `"${term}"*`)
    .join(' AND ');
}
