/** The element at `index` (negative counts from the end); fails the test when there is none. */
export function at<T>(list: readonly T[], index: number): T {
  const item = list.at(index);
  if (item === undefined) throw new Error(`expected an element at index ${index}`);
  return item;
}

/** The only element; fails the test when the list does not hold exactly one. */
export function only<T>(list: readonly T[]): T {
  if (list.length !== 1) throw new Error(`expected one element, got ${list.length}`);
  return at(list, 0);
}
