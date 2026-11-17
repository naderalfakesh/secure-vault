import type { PropsWithChildren } from 'react';

export type SheetDetent = 'auto' | 'medium' | 'large';

export type SheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Leading text button in the header, e.g. "Cancel" or "Reset". */
  headerAction?: { label: string; onPress: () => void };
  /**
   * False while work is in progress: no close button, and neither the
   * backdrop nor the back gesture closes the sheet.
   */
  dismissable?: boolean;
  /**
   * False hides the close button while the sheet stays dismissable, for a
   * sheet whose header action is already Cancel (one way out, not two).
   */
  closeButton?: boolean;
  /** `auto` fits the content; `medium` and `large` fix the height. */
  detent?: SheetDetent;
  /**
   * The body scrolls when it is taller than the sheet, as it is at the
   * largest text sizes. Turn it off only when the body is itself a
   * scroll view or list.
   */
  scroll?: boolean;
  /**
   * Called once the modal has finished going away, so the next system
   * presentation (a picker) is not handed a view controller being dismissed.
   * iOS only; React Native's Modal reports no dismissal on Android.
   */
  onDismissed?: () => void;
  testID?: string;
}>;

export type SheetHeaderProps = Pick<
  SheetProps,
  'title' | 'headerAction' | 'dismissable' | 'closeButton' | 'onClose'
>;
