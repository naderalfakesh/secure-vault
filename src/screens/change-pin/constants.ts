import type { StringKey } from '@/i18n';

import type { Stage } from './types';

export const TITLES: Record<Stage, StringKey> = {
  current: 'changePin.title.current',
  next: 'changePin.title.next',
  confirm: 'changePin.title.confirm',
  saving: 'changePin.title.saving',
};

export const STEPS: Record<Stage, number> = { current: 1, next: 2, confirm: 3, saving: 3 };

export const TOTAL_STEPS = 3;

/** The lockout countdown ticks once a second. */
export const LOCKOUT_TICK_MS = 1000;
