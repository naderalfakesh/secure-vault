type StackAnimation = 'none' | 'fade' | 'default';

/**
 * How the root stack moves between screens: not at all under the splash
 * handoff, and with a cross-fade instead of a slide under reduced motion.
 */
export function stackAnimation(handingOff: boolean, reduceMotion: boolean): StackAnimation {
  if (handingOff) return 'none';
  return reduceMotion ? 'fade' : 'default';
}
