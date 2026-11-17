import type { ViewStyle } from 'react-native';

/** Stroke on the 24 pt grid. */
export const ICON_STROKE = 1.75;

/** Flips a directional glyph in a right-to-left layout. */
export const MIRRORED: ViewStyle = { transform: [{ scaleX: -1 }] };
