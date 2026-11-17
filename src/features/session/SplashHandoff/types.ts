export type Scheme = 'light' | 'dark';

export type SplashHandoffProps = {
  released: boolean;
  /** Called once the overlay is gone, so the navigator can animate again. */
  onDone?: () => void;
};
