import { Platform } from 'react-native';

/**
 * "Choose another file" opens the picker only once the restore sheet's modal
 * is gone: iOS presents the picker on the top view controller, and one being
 * dismissed takes the picker down with it without telling expo-document-picker,
 * whose in-progress flag then refuses every later pick until a relaunch. iOS
 * reports the dismissal; this is the fallback if it never comes, and the
 * delay on Android, where the picker is its own activity.
 */
export const SHEET_GONE_FALLBACK_MS = Platform.OS === 'ios' ? 1000 : 250;
/** The one retry after the picker said another pick was still in progress. */
export const PICKER_RETRY_MS = 600;

export const PICKER_OPTIONS = { type: '*/*', copyToCacheDirectory: true } as const;
