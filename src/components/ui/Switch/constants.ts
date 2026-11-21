import type { ViewStyle } from 'react-native';

/**
 * Right to left, "on" sits at the left on both platforms. Neither native
 * switch takes the direction from React Native in this app: Android's ignores
 * it, and on iOS a layout forced right to left does not reach UISwitch,
 * as it does not reach the SF Symbols (see Icon). QA on iOS 27 showed "on" at
 * the right without this flip, so both are mirrored here, once.
 */
export const MIRRORED: ViewStyle = { transform: [{ scaleX: -1 }] };
