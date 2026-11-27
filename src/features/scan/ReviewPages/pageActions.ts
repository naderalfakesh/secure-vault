import { scanText } from '../scanCopy';

export function pageActions(index: number, count: number) {
  return [
    ...(index > 0 ? [{ name: 'moveEarlier', label: scanText('review.moveEarlier') }] : []),
    ...(index < count - 1 ? [{ name: 'moveLater', label: scanText('review.moveLater') }] : []),
    { name: 'remove', label: scanText('review.remove') },
  ];
}
