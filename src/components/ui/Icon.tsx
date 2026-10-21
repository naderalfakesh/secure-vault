import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SymbolView, type SymbolWeight } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { I18nManager, Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import type { TextTone } from './Text';

type FeatherName = ComponentProps<typeof Feather>['name'];
type CommunityName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Glyph = {
  /** SF Symbol (outline) used on iOS. */
  sf: ComponentProps<typeof SymbolView>['name'];
  /**
   * Android and fallback glyph: Feather (Lucide's outline ancestor, 24 grid,
   * round caps) where it has a match, Material Community outlines otherwise.
   */
  android: { feather: FeatherName } | { community: CommunityName };
  /** Directional glyphs flip in right-to-left layouts. */
  mirror?: boolean;
};

const feather = (name: FeatherName) => ({ feather: name });
const community = (name: CommunityName) => ({ community: name });

/**
 * One outline icon vocabulary for the app (handover §3.4): SF Symbols on iOS,
 * the closest outline glyph on Android, so screens never branch on platform.
 */
export const icons = {
  lock: { sf: 'lock', android: feather('lock') },
  unlock: { sf: 'lock.open', android: feather('unlock') },
  faceId: { sf: 'faceid', android: community('face-recognition') },
  fingerprint: { sf: 'touchid', android: community('fingerprint') },
  scan: { sf: 'doc.viewfinder', android: community('line-scan') },
  camera: { sf: 'camera', android: feather('camera') },
  photos: { sf: 'photo.on.rectangle', android: community('image-multiple-outline') },
  image: { sf: 'photo', android: feather('image') },
  files: { sf: 'folder', android: feather('folder') },
  folder: { sf: 'folder', android: feather('folder') },
  document: { sf: 'doc.text', android: feather('file-text') },
  pdf: { sf: 'doc.richtext', android: community('file-pdf-box') },
  pages: { sf: 'square.on.square', android: community('file-multiple-outline') },
  search: { sf: 'magnifyingglass', android: feather('search') },
  settings: { sf: 'slider.horizontal.3', android: feather('sliders') },
  home: { sf: 'house', android: feather('home') },
  grid: { sf: 'square.grid.2x2', android: feather('grid') },
  library: { sf: 'square.grid.2x2', android: feather('grid') },
  plus: { sf: 'plus', android: feather('plus') },
  close: { sf: 'xmark', android: feather('x') },
  check: { sf: 'checkmark', android: feather('check') },
  checkCircle: { sf: 'checkmark.circle', android: feather('check-circle') },
  chevronRight: { sf: 'chevron.right', android: feather('chevron-right'), mirror: true },
  chevronLeft: { sf: 'chevron.left', android: feather('chevron-left'), mirror: true },
  back: { sf: 'chevron.left', android: feather('chevron-left'), mirror: true },
  more: { sf: 'ellipsis', android: feather('more-horizontal') },
  share: { sf: 'square.and.arrow.up', android: feather('share') },
  export: { sf: 'square.and.arrow.down', android: feather('download') },
  trash: { sf: 'trash', android: feather('trash-2') },
  edit: { sf: 'pencil', android: feather('edit-2') },
  copy: { sf: 'doc.on.doc', android: feather('copy') },
  tag: { sf: 'tag', android: feather('tag') },
  calendar: { sf: 'calendar', android: feather('calendar') },
  warning: { sf: 'exclamationmark.triangle', android: feather('alert-triangle') },
  info: { sf: 'info.circle', android: feather('info') },
  shield: { sf: 'checkmark.shield', android: community('shield-check-outline') },
  key: { sf: 'key', android: feather('key') },
  eye: { sf: 'eye', android: feather('eye') },
  eyeOff: { sf: 'eye.slash', android: feather('eye-off') },
  text: { sf: 'text.alignleft', android: feather('align-left') },
  sparkles: { sf: 'sparkles', android: community('creation-outline') },
  archive: { sf: 'archivebox', android: feather('archive') },
  backup: { sf: 'archivebox', android: feather('archive') },
  restore: { sf: 'arrow.up.doc', android: feather('upload') },
  refresh: { sf: 'arrow.clockwise', android: feather('refresh-cw') },
  backspace: { sf: 'delete.left', android: community('backspace-outline') },
  sort: { sf: 'arrow.up.arrow.down', android: community('swap-vertical') },
  filter: { sf: 'line.3.horizontal.decrease', android: feather('filter') },
  moon: { sf: 'moon', android: feather('moon') },
  clock: { sf: 'clock', android: feather('clock') },
  idCard: { sf: 'person.text.rectangle', android: community('card-account-details-outline') },
  medical: { sf: 'cross.case', android: community('medical-bag') },
  finance: { sf: 'banknote', android: community('cash') },
  legal: { sf: 'building.columns', android: community('scale-balance') },
  insurance: { sf: 'umbrella', android: community('umbrella-outline') },
  receipt: { sf: 'receipt', android: community('receipt-text-outline') },
  other: { sf: 'tray.full', android: feather('inbox') },
  /** The SecureVault mark: a document with a padlock. */
  mark: { sf: 'lock.doc', android: community('file-lock-outline') },
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof icons;

export type IconProps = {
  name: IconName;
  size?: number;
  tone?: TextTone;
  /** Explicit color wins over tone. */
  color?: string;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

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

function FallbackGlyph({ glyph, size, color }: { glyph: Glyph; size: number; color: string }) {
  return 'feather' in glyph.android ? (
    <Feather name={glyph.android.feather} size={size} color={color} />
  ) : (
    <MaterialCommunityIcons name={glyph.android.community} size={size} color={color} />
  );
}

export function Icon({
  name,
  size = 22,
  tone = 'primary',
  color,
  weight = 'regular',
  style,
  accessibilityLabel,
}: IconProps) {
  const { theme } = useUnistyles();
  const tint = color ?? theme.colors[toneToColor[tone]];
  const glyph: Glyph = icons[name];
  const decorative = !accessibilityLabel;

  if (Platform.OS === 'ios') {
    // SF Symbols pick their right-to-left variants themselves.
    return (
      <SymbolView
        name={glyph.sf}
        size={size}
        tintColor={tint}
        weight={weight}
        style={[{ width: size, height: size }, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityElementsHidden={decorative}
        fallback={<FallbackGlyph glyph={glyph} size={size} color={tint} />}
      />
    );
  }

  const flip = glyph.mirror && I18nManager.isRTL;

  return (
    <View
      style={[{ width: size, height: size }, flip ? mirrored : null, style]}
      accessibilityLabel={accessibilityLabel}
      accessible={!decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      <FallbackGlyph glyph={glyph} size={size} color={tint} />
    </View>
  );
}

const mirrored: ViewStyle = { transform: [{ scaleX: -1 }] };
