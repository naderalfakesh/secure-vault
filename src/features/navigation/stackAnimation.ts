type StackAnimation = 'none' | 'fade' | 'default';

export function stackAnimation(handingOff: boolean, reduceMotion: boolean): StackAnimation {
  if (handingOff) return 'none';
  return reduceMotion ? 'fade' : 'default';
}
