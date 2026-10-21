import { appLocale, t, tp } from '@/i18n';

export function formatDate(iso: string, locale: string = appLocale().tag): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return t('format.bytes', { value: bytes });
  if (bytes < 1024 * 1024) return t('format.kilobytes', { value: (bytes / 1024).toFixed(1) });
  return t('format.megabytes', { value: (bytes / (1024 * 1024)).toFixed(1) });
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Short relative date for list rows: "Today", "Yesterday", a weekday within
 * the last week, "9 Oct" this year, "9 Oct 2025" before that.
 */
export function formatRelativeDate(
  iso: string,
  now: Date = new Date(),
  locale: string = appLocale().tag,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0) return t('format.today');
  if (days === 1) return t('format.yesterday');
  if (days > 1 && days < 7) return date.toLocaleDateString(locale, { weekday: 'short' });
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? null : { year: 'numeric' }),
  });
}

/** Brass expiry line: "Expires in 82 days", "Expires today", "Expired 3 Jan 2026". */
export function formatExpiry(
  dateIso: string,
  now: Date = new Date(),
  locale: string = appLocale().tag,
): string {
  const date = new Date(`${dateIso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((date.getTime() - startOfDay(now)) / DAY_MS);
  const long = date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  if (days < 0) return t('format.expired', { date: long });
  if (days === 0) return t('format.expiresToday');
  if (days === 1) return t('format.expiresTomorrow');
  if (days <= 90) return tp('format.expiresInDays', days);
  return t('format.expiresOn', { date: long });
}

/** Short parts on one line, e.g. "Identity · 2 pages · Today"; empty parts drop out. */
export function joinParts(parts: readonly (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(t('format.separator'));
}

/** @deprecated Use `tp` with a `format.*` plural key; removed once every caller moves. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
