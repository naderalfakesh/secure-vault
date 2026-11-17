import { stackAnimation } from '../stackAnimation';

describe('stackAnimation', () => {
  it('does not animate under the splash handoff', () => {
    expect(stackAnimation(true, false)).toBe('none');
    expect(stackAnimation(true, true)).toBe('none');
  });

  it('cross-fades with reduced motion and slides otherwise', () => {
    expect(stackAnimation(false, true)).toBe('fade');
    expect(stackAnimation(false, false)).toBe('default');
  });
});
