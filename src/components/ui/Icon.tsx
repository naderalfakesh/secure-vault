import { type SFSymbol, SymbolView, type SymbolWeight } from 'expo-symbols';
import { I18nManager, Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

import { type IconPath, iconPaths } from './iconPaths';
import type { TextTone } from './Text';

type Glyph = {
  /** The outline glyph: drawn on Android, and on iOS when `sf` is absent. */
  d: IconPath;
  /**
   * SF Symbol used on iOS where the system has the same glyph. Glyphs the
   * system has no match for (the mark, scan, settings sliders, filter, legal,
   * restore) draw the design's SVG on iOS too.
   */
  sf?: SFSymbol;
  /** Directional glyphs flip in right-to-left layouts. */
  mirror?: boolean;
};

/**
 * One outline icon vocabulary for the app: the design's SVG
 * set on a 24 pt grid, with SF Symbols on iOS where they match, so screens
 * never branch on platform.
 */
export const icons = {
  lock: { d: 'lock', sf: 'lock' },
  unlock: { d: 'unlock', sf: 'lock.open' },
  faceId: { d: 'faceid', sf: 'faceid' },
  fingerprint: { d: 'fingerprint', sf: 'touchid' },
  scan: { d: 'scan' },
  camera: { d: 'camera', sf: 'camera' },
  photos: { d: 'photos', sf: 'photo.on.rectangle' },
  image: { d: 'image', sf: 'photo' },
  files: { d: 'folder', sf: 'folder' },
  folder: { d: 'folder', sf: 'folder' },
  document: { d: 'doc', sf: 'doc.text' },
  pdf: { d: 'doc', sf: 'doc.text' },
  pages: { d: 'pages', sf: 'doc.on.doc' },
  search: { d: 'search', sf: 'magnifyingglass' },
  settings: { d: 'settings' },
  grid: { d: 'library', sf: 'square.grid.2x2' },
  library: { d: 'library', sf: 'square.grid.2x2' },
  plus: { d: 'plus', sf: 'plus' },
  close: { d: 'x', sf: 'xmark' },
  check: { d: 'check', sf: 'checkmark' },
  checkCircle: { d: 'checkCircle', sf: 'checkmark.circle' },
  chevronRight: { d: 'chevR', sf: 'chevron.right', mirror: true },
  chevronLeft: { d: 'chevL', sf: 'chevron.left', mirror: true },
  back: { d: 'chevL', sf: 'chevron.left', mirror: true },
  more: { d: 'more', sf: 'ellipsis' },
  share: { d: 'share', sf: 'square.and.arrow.up' },
  export: { d: 'exportI', sf: 'square.and.arrow.down' },
  trash: { d: 'trash', sf: 'trash' },
  edit: { d: 'edit', sf: 'pencil' },
  tag: { d: 'tag', sf: 'tag' },
  calendar: { d: 'calendar', sf: 'calendar' },
  warning: { d: 'alert', sf: 'exclamationmark.triangle' },
  info: { d: 'info', sf: 'info.circle' },
  shield: { d: 'shield', sf: 'checkmark.shield' },
  key: { d: 'key', sf: 'key' },
  eye: { d: 'eye', sf: 'eye' },
  eyeOff: { d: 'eyeOff', sf: 'eye.slash' },
  text: { d: 'text', sf: 'text.alignleft' },
  sparkles: { d: 'sparkles', sf: 'sparkles' },
  archive: { d: 'archive', sf: 'archivebox' },
  backup: { d: 'archive', sf: 'archivebox' },
  restore: { d: 'restore' },
  refresh: { d: 'refresh', sf: 'arrow.triangle.2.circlepath' },
  backspace: { d: 'backspace', sf: 'delete.left' },
  sort: { d: 'sort', sf: 'arrow.up.arrow.down' },
  filter: { d: 'filter' },
  clock: { d: 'clock', sf: 'clock' },
  idCard: { d: 'idcard', sf: 'person.text.rectangle' },
  medical: { d: 'medical', sf: 'cross' },
  finance: { d: 'finance', sf: 'banknote' },
  legal: { d: 'legal' },
  insurance: { d: 'umbrella', sf: 'umbrella' },
  receipt: { d: 'receipt', sf: 'receipt' },
  other: { d: 'tray', sf: 'tray' },
  /** The SecureVault mark: a folded-corner document with a padlock. */
  mark: { d: 'mark' },
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof icons;

export type IconProps = {
  name: IconName;
  size?: number;
  tone?: TextTone;
  /** Explicit color wins over tone. */
  color?: string;
  /** SF Symbol weight on iOS. */
  weight?: SymbolWeight;
  /** Stroke on the 24 pt grid: 1.75 by default, 1.5 for the large mark. */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export const ICON_STROKE = 1.75;

const toneToColor = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  inverse: 'onPrimary',
  accent: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const;

/** The bare outline glyph, drawn from the design's path. */
export function IconGlyph({
  path,
  size,
  color,
  strokeWidth = ICON_STROKE,
}: {
  path: IconPath;
  size: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={iconPaths[path]}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Icon({
  name,
  size = 22,
  tone = 'primary',
  color,
  weight = 'regular',
  strokeWidth,
  style,
  accessibilityLabel,
}: IconProps) {
  const { theme } = useUnistyles();
  const tint = color ?? theme.colors[toneToColor[tone]];
  const glyph: Glyph = icons[name];
  const decorative = !accessibilityLabel;

  // Directional glyphs are named for a side ("chevron.right"), which neither
  // SF Symbols nor the SVG flips, so both platforms mirror them in a
  // right-to-left layout. The keypad's backspace is not directional and never flips.
  const flip = glyph.mirror && I18nManager.isRTL;
  const svg = <IconGlyph path={glyph.d} size={size} color={tint} strokeWidth={strokeWidth} />;

  if (Platform.OS === 'ios' && glyph.sf) {
    return (
      <SymbolView
        name={glyph.sf}
        size={size}
        tintColor={tint}
        weight={weight}
        style={[{ width: size, height: size }, flip ? mirrored : null, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityElementsHidden={decorative}
        fallback={svg}
      />
    );
  }

  return (
    <View
      style={[{ width: size, height: size }, flip ? mirrored : null, style]}
      accessibilityLabel={accessibilityLabel}
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      {svg}
    </View>
  );
}

const mirrored: ViewStyle = { transform: [{ scaleX: -1 }] };
