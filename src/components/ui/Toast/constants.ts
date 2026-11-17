import type { IconName } from '../Icon';
import type { ToastTone } from './types';

export const toneIcon: Record<ToastTone, IconName> = {
  neutral: 'info',
  success: 'checkCircle',
  danger: 'warning',
};

/** Space kept clear below a toast: the tab bar plus 16 pt. */
export const TAB_BAR_CLEARANCE = 72;

/** Entrance and exit: a rise and fall, or a plain fade with reduced motion. */
export const ENTER_MS = 220;
export const EXIT_MS = 180;
export const FADE_IN_MS = 160;
export const FADE_OUT_MS = 120;

/** The undo countdown ring. */
export const RING = 28;
export const RING_STROKE = 2;
export const RING_RADIUS = (RING - RING_STROKE) / 2;
export const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
