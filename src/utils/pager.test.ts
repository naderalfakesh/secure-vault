import {
  EDGE_SWIPE_DISTANCE,
  edgeSwipe,
  offsetForPage,
  pageForSwipe,
  pageFromOffset,
} from './pager';

const pages = { pageWidth: 390, contentWidth: 390 * 4, pageCount: 4 };

describe('pager index maths', () => {
  it('counts pages from the left in a left-to-right layout', () => {
    expect(pageFromOffset({ ...pages, offsetX: 0, rtl: false })).toBe(0);
    expect(pageFromOffset({ ...pages, offsetX: 390 * 2, rtl: false })).toBe(2);
    expect(offsetForPage(3, 390, 4, false)).toBe(390 * 3);
  });

  it('counts pages from the right in a right-to-left layout', () => {
    // The first page rests at the right end: the largest left-edge offset.
    expect(pageFromOffset({ ...pages, offsetX: 390 * 3, rtl: true })).toBe(0);
    expect(pageFromOffset({ ...pages, offsetX: 0, rtl: true })).toBe(3);
    expect(pageFromOffset({ ...pages, offsetX: 390 * 2, rtl: true })).toBe(1);
    expect(offsetForPage(0, 390, 4, true)).toBe(390 * 3);
    expect(offsetForPage(3, 390, 4, true)).toBe(0);
  });

  it('round-trips every page in both directions', () => {
    for (const rtl of [false, true]) {
      for (let index = 0; index < pages.pageCount; index += 1) {
        const offsetX = offsetForPage(index, pages.pageWidth, pages.pageCount, rtl);
        expect(pageFromOffset({ ...pages, offsetX, rtl })).toBe(index);
      }
    }
  });

  it('clamps an overscroll and ignores an unmeasured pager', () => {
    expect(pageFromOffset({ ...pages, offsetX: -200, rtl: false })).toBe(0);
    expect(pageFromOffset({ ...pages, offsetX: 99999, rtl: false })).toBe(3);
    expect(pageFromOffset({ ...pages, pageWidth: 0, offsetX: 10 })).toBe(0);
  });
});

describe('swipe paging', () => {
  it('turns to the neighbour a swipe brings in, mirrored right to left', () => {
    expect(pageForSwipe(0, 'left', 3, false)).toBe(1);
    expect(pageForSwipe(1, 'right', 3, false)).toBe(0);
    expect(pageForSwipe(0, 'right', 3, true)).toBe(1);
    expect(pageForSwipe(1, 'left', 3, true)).toBe(0);
  });

  it('stops at either end', () => {
    expect(pageForSwipe(0, 'right', 3, false)).toBeNull();
    expect(pageForSwipe(2, 'left', 3, false)).toBeNull();
    expect(pageForSwipe(0, 'left', 3, true)).toBeNull();
    expect(pageForSwipe(0, 'left', 1, false)).toBeNull();
  });

  it('pages a zoomed drag only when it starts at the edge and pulls past it', () => {
    const bound = 200;
    // From the middle, even a long drag only pans.
    expect(edgeSwipe(0, -1000, bound)).toBeNull();
    // At the edge, a short pull pans; a long one pages.
    expect(edgeSwipe(-bound, -EDGE_SWIPE_DISTANCE + 10, bound)).toBeNull();
    expect(edgeSwipe(-bound, -EDGE_SWIPE_DISTANCE - 10, bound)).toBe('left');
    expect(edgeSwipe(bound, EDGE_SWIPE_DISTANCE + 10, bound)).toBe('right');
    // Dragging back from an edge pans toward the other side.
    expect(edgeSwipe(-bound, 300, bound)).toBeNull();
  });
});
