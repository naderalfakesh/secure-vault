/** Counts, sizes and dates used inside other sentences. */
export const format = {
  'format.documents.one': '{count} document',
  'format.documents.other': '{count} documents',
  'format.pages.one': '{count} page',
  'format.pages.other': '{count} pages',
  'format.entries.one': '{count} entry',
  'format.entries.other': '{count} entries',
  'format.bytes': '{value} B',
  'format.kilobytes': '{value} KB',
  'format.megabytes': '{value} MB',
  'format.today': 'Today',
  'format.yesterday': 'Yesterday',
  'format.expired': 'Expired {date}',
  'format.expiresToday': 'Expires today',
  'format.expiresTomorrow': 'Expires tomorrow',
  'format.expiresInDays.one': 'Expires in {count} day',
  'format.expiresInDays.other': 'Expires in {count} days',
  'format.expiresOn': 'Expires {date}',
  /** A list of short parts on one line: "Identity · 2 pages · Today". */
  'format.separator': ' · ',
} as const;
