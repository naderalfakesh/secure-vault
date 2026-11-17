import { disabledPlainFill, fills } from './constants';
import type { ButtonFill, ButtonVariant } from './types';

/** Text buttons: no fill and tighter padding. */
export function isPlainVariant(variant: ButtonVariant): boolean {
  return variant === 'plain' || variant === 'plainDestructive';
}

/**
 * The colours for a button's state. A busy button keeps its colours so the
 * spinner reads as progress, not as "off"; a disabled text button stays
 * unfilled, and only its label greys out.
 */
export function buttonFill(
  variant: ButtonVariant,
  disabled: boolean,
  loading: boolean,
): ButtonFill {
  if (!disabled || loading) return fills[variant];
  return isPlainVariant(variant) ? disabledPlainFill : fills.disabled;
}
