import type { PropsWithChildren } from 'react';

export type SheetDetent = 'auto' | 'medium' | 'large';

export type SheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  headerAction?: { label: string; onPress: () => void };
  dismissable?: boolean;
  closeButton?: boolean;
  detent?: SheetDetent;
  scroll?: boolean;
  /** iOS-only: fires after Modal dismissal completes so a subsequent system picker isn't dropped. */
  onDismissed?: () => void;
  testID?: string;
}>;

export type SheetHeaderProps = Pick<
  SheetProps,
  'title' | 'headerAction' | 'dismissable' | 'closeButton' | 'onClose'
>;
