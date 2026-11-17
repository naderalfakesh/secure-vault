import type { IconName } from '../Icon';

export type ToastTone = 'neutral' | 'success' | 'danger';

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  /** Optional action such as "View" or "Undo". */
  action?: { label: string; onPress: () => void };
  /** Leading icon; defaults to one per tone. */
  icon?: IconName;
  /** Show a countdown ring next to the action, e.g. for Undo. */
  countdown?: boolean;
  /** Defaults to 4 s, or 8 s with an action. */
  durationMs?: number;
};

export type ToastState = ToastOptions & { id: number; durationMs: number };

export type ToastContextValue = {
  show: (options: ToastOptions) => void;
  hide: () => void;
};

export type ToastViewProps = { toast: ToastState; onHide: () => void };

export type CountdownProps = { durationMs: number; still: boolean };
