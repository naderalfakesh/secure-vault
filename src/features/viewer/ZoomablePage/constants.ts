export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const PINCH_MIN_SCALE = 0.6;
export const DOUBLE_TAP_SCALE = 2.5;
/** A dismiss drag farther than this, in points, closes the viewer. */
export const DISMISS_THRESHOLD = 110;
/** A dismiss drag shrinks the page by at most this fraction. */
export const DISMISS_MAX_SHRINK = 0.4;
/** Vertical travel that starts a dismiss drag at rest. */
export const DISMISS_ACTIVE_OFFSET_Y = 12;
/** Horizontal travel that hands a drag at rest to the pager instead. */
export const DISMISS_FAIL_OFFSET_X = 16;
/** A pinch settles a half-made dismiss drag back this fast. */
export const PINCH_RESET_MS = 100;
/** Cross-fade when the page image arrives. */
export const IMAGE_TRANSITION_MS = 120;

export const NO_SWIPE = { left: false, right: false };
