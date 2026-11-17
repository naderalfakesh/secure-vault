import type { StringKey } from '@/i18n';

/** Glass controls and text on the stage are white in both themes. */
export const STAGE_INK = '#FFFFFF';
export const STAGE_INK_DIM = '#B3BAD1';
/** The border of the page shown in the page strip. */
export const STRIP_SELECTED = '#8EA2FF';

/** The loading placeholder appears only once a page takes longer than this. */
export const PLACEHOLDER_DELAY_MS = 300;
/** Lets a sheet finish closing before the next sheet or the system share sheet opens. */
export const SHEET_CLOSE_MS = 450;
/** The preparing step shows only for a copy that takes longer than this. */
export const PREPARING_DELAY_MS = 400;

/** Space between the safe area and the top bar. */
export const TOP_BAR_GAP = 6;
/** The banner's distance from the safe area, below the top bar or without it. */
export const BANNER_OFFSET_WITH_CHROME = 62;
export const BANNER_OFFSET = 10;
/** Space between the safe area and the bottom bar. */
export const BOTTOM_BAR_GAP = 16;

/** Titles of the fields the scanner recognises; any other key is shown as is. */
export const FIELD_TITLES: Record<string, StringKey> = {
  expires: 'viewer.field.expires',
  issued: 'viewer.field.issued',
  number: 'viewer.field.number',
};
