import type { ButtonFill, ButtonVariant } from './types';

export const fills: Record<ButtonVariant | 'disabled', ButtonFill> = {
  primary: { background: 'primary', foreground: 'onPrimary' },
  tinted: { background: 'primaryMuted', foreground: 'primary' },
  plain: { background: 'transparent', foreground: 'primary' },
  /** Text-only destructive action, e.g. "Delete 3" in a toolbar. */
  plainDestructive: { background: 'transparent', foreground: 'danger' },
  secondary: { background: 'surfaceMuted', foreground: 'textPrimary' },
  destructive: { background: 'danger', foreground: 'onDanger' },
  destructiveSoft: { background: 'dangerMuted', foreground: 'danger' },
  disabled: { background: 'surfaceMuted', foreground: 'textTertiary' },
};

/** The fill of a disabled text button: no background, a grey label. */
export const disabledPlainFill: ButtonFill = {
  background: 'transparent',
  foreground: 'textTertiary',
};
