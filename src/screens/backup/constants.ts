import { Platform } from 'react-native';

// iOS drops expo-document-picker if presented on a dismissing modal (locking its in-progress flag until relaunch).
// Fallback timeout if onDismissed never fires on iOS, and the close delay on Android.
export const SHEET_GONE_FALLBACK_MS = Platform.OS === 'ios' ? 1000 : 250;
export const PICKER_RETRY_MS = 600;

export const PICKER_OPTIONS = { type: '*/*', copyToCacheDirectory: true } as const;
