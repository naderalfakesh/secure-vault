/**
 * Turns free text into an FTS5 query: each word becomes a quoted prefix term
 * joined with AND, so "pass 20" matches "Passport 2030" and user input can
 * never change the query's structure.
 */
export function toFtsQuery(input: string): string {
  return input
    .split(/\s+/)
    .map((term) => term.replace(/["*]/g, '').trim())
    .filter(Boolean)
    .map((term) => `"${term}"*`)
    .join(' AND ');
}
