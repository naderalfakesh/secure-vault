import { type Insets, StyleSheet, type ViewStyle } from 'react-native';

/** The minimum touch target, in points (handover §3.3, §10.2). */
export const MIN_TARGET = 44;

const CONTROL_ROLES = new Set([
  'button',
  'imagebutton',
  'link',
  'tab',
  'switch',
  'checkbox',
  'radio',
  'togglebutton',
]);

/** A host element as `toJSON()` of a render returns it. */
type Node = {
  type: string;
  props: Record<string, any>;
  children: (Node | string)[] | null;
};
type Json = Node | Node[] | null;

function nodes(json: Json): Node[] {
  if (!json) return [];
  return Array.isArray(json) ? json : [json];
}

function children(node: Node): Node[] {
  return (node.children ?? []).filter((child): child is Node => typeof child !== 'string');
}

function hasText(node: Node): boolean {
  if (node.type === 'Text' && (node.children ?? []).some((c) => typeof c === 'string' && c.trim()))
    return true;
  return children(node).some(hasText);
}

function slop(hitSlop: unknown): Required<Pick<Insets, 'top' | 'bottom' | 'left' | 'right'>> {
  if (typeof hitSlop === 'number') {
    return { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop };
  }
  const insets = (hitSlop ?? {}) as Insets;
  return {
    top: insets.top ?? 0,
    bottom: insets.bottom ?? 0,
    left: insets.left ?? 0,
    right: insets.right ?? 0,
  };
}

function size(style: ViewStyle, exact: 'width' | 'height', min: 'minWidth' | 'minHeight') {
  const value = style[exact];
  const floor = style[min];
  const fixed = typeof value === 'number' ? value : null;
  const least = typeof floor === 'number' ? floor : null;
  if (fixed === null && least === null) return null;
  return Math.max(fixed ?? 0, least ?? 0);
}

function describe(node: Node): string {
  const { accessibilityLabel, testID, accessibilityRole } = node.props;
  return `${accessibilityRole ?? node.type} ${JSON.stringify(accessibilityLabel ?? testID ?? '')}`;
}

/**
 * Walks a rendered screen and lists its accessibility problems: anything
 * that takes a press (onPress, onClick, onLongPress) without a role, a
 * control with no spoken name (an icon-only button without a label), and a
 * control whose own size plus hit slop is under 44 pt, where the style
 * states a size. Controls sized only by padding and text cannot be measured
 * here and are left to the native checks.
 */
export function auditAccessibility(json: Json): string[] {
  const problems: string[] = [];
  const visit = (node: Node) => {
    const { props } = node;
    const hidden =
      props.accessibilityElementsHidden === true ||
      props.importantForAccessibility === 'no-hide-descendants' ||
      props['aria-hidden'] === true;
    if (hidden) return;
    const role = props.accessibilityRole ?? props.role;
    // Anything that takes a press is a control, whatever role it claims.
    const pressable =
      node.type !== 'TextInput' &&
      (typeof props.onPress === 'function' ||
        typeof props.onClick === 'function' ||
        typeof props.onLongPress === 'function');
    const control = props.accessible !== false && (CONTROL_ROLES.has(role) || pressable);
    if (control) {
      if (!role || role === 'none') {
        problems.push(`${describe(node)} takes a press but has no accessibilityRole`);
      }
      const label = props.accessibilityLabel ?? props['aria-label'];
      if (!(typeof label === 'string' && label.trim()) && !hasText(node)) {
        problems.push(`${describe(node)} has no accessibility label`);
      }
      const style = StyleSheet.flatten(props.style) ?? {};
      const insets = slop(props.hitSlop);
      const height = size(style, 'height', 'minHeight');
      const width = size(style, 'width', 'minWidth');
      if (height !== null && height + insets.top + insets.bottom < MIN_TARGET) {
        problems.push(
          `${describe(node)} is ${height} pt high (+${insets.top + insets.bottom} slop)`,
        );
      }
      if (width !== null && width + insets.left + insets.right < MIN_TARGET) {
        problems.push(
          `${describe(node)} is ${width} pt wide (+${insets.left + insets.right} slop)`,
        );
      }
    }
    children(node).forEach(visit);
  };
  nodes(json).forEach(visit);
  return problems;
}

/** Counts the controls the audit looked at, so a test can show it saw the screen. */
export function countControls(json: Json): number {
  let count = 0;
  const visit = (node: Node) => {
    const role = node.props.accessibilityRole ?? node.props.role;
    const pressable =
      typeof node.props.onPress === 'function' || typeof node.props.onClick === 'function';
    if (CONTROL_ROLES.has(role) || pressable) count += 1;
    children(node).forEach(visit);
  };
  nodes(json).forEach(visit);
  return count;
}
