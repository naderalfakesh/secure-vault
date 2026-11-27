import { disabledPlainFill, fills } from './constants';
import type { ButtonFill, ButtonVariant } from './types';

export function isPlainVariant(variant: ButtonVariant): boolean {
  return variant === 'plain' || variant === 'plainDestructive';
}

// Busy buttons keep active colours so the spinner reads as progress rather than disabled.
export function buttonFill(
  variant: ButtonVariant,
  disabled: boolean,
  loading: boolean,
): ButtonFill {
  if (!disabled || loading) return fills[variant];
  return isPlainVariant(variant) ? disabledPlainFill : fills.disabled;
}
