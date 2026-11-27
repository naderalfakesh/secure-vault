import type { IconName } from '../Icon';

export type ToastTone = 'neutral' | 'success' | 'danger';

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  action?: { label: string; onPress: () => void };
  icon?: IconName;
  countdown?: boolean;
  durationMs?: number;
};

export type ToastState = ToastOptions & { id: number; durationMs: number };

export type ToastContextValue = {
  show: (options: ToastOptions) => void;
  hide: () => void;
};

export type ToastViewProps = { toast: ToastState; onHide: () => void };

export type CountdownProps = { durationMs: number; still: boolean };
