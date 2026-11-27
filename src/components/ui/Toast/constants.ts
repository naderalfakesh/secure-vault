import type { IconName } from '../Icon';
import type { ToastTone } from './types';

export const toneIcon: Record<ToastTone, IconName> = {
  neutral: 'info',
  success: 'checkCircle',
  danger: 'warning',
};

export const TAB_BAR_CLEARANCE = 72;

export const ENTER_MS = 220;
export const EXIT_MS = 180;
export const FADE_IN_MS = 160;
export const FADE_OUT_MS = 120;

export const RING = 28;
export const RING_STROKE = 2;
export const RING_RADIUS = (RING - RING_STROKE) / 2;
export const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
