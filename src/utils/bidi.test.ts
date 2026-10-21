import { isolate } from './bidi';

describe('isolate', () => {
  it('wraps mixed-direction names in first strong isolate marks once', () => {
    const name = 'عقد الإيجار 2026.pdf';
    const isolated = isolate(name);

    expect(isolated).toBe(`⁨${name}⁩`);
    expect(isolate(isolated)).toBe(isolated);
  });
});
