/** Props for purely visual elements: screen readers skip them and their children. */
export const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;
