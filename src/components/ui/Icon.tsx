import { MaterialIcons } from '@expo/vector-icons';
import { SymbolView, type SymbolWeight } from 'expo-symbols';
import { Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import type { TextTone } from './Text';

/**
 * One icon vocabulary for the app. iOS renders SF Symbols, Android renders the
 * closest Material glyph, so screens never branch on platform for an icon.
 */
export const icons = {
  lock: { sf: 'lock.fill', material: 'lock' },
  unlock: { sf: 'lock.open.fill', material: 'lock-open' },
  faceId: { sf: 'faceid', material: 'face' },
  fingerprint: { sf: 'touchid', material: 'fingerprint' },
  scan: { sf: 'doc.viewfinder', material: 'document-scanner' },
  camera: { sf: 'camera.fill', material: 'photo-camera' },
  photos: { sf: 'photo.on.rectangle', material: 'photo-library' },
  files: { sf: 'folder.fill', material: 'folder' },
  document: { sf: 'doc.text.fill', material: 'description' },
  pdf: { sf: 'doc.richtext.fill', material: 'picture-as-pdf' },
  search: { sf: 'magnifyingglass', material: 'search' },
  settings: { sf: 'gearshape.fill', material: 'settings' },
  home: { sf: 'house.fill', material: 'home' },
  grid: { sf: 'square.grid.2x2.fill', material: 'grid-view' },
  plus: { sf: 'plus', material: 'add' },
  close: { sf: 'xmark', material: 'close' },
  check: { sf: 'checkmark', material: 'check' },
  chevronRight: { sf: 'chevron.right', material: 'chevron-right' },
  back: { sf: 'chevron.left', material: 'arrow-back' },
  more: { sf: 'ellipsis', material: 'more-horiz' },
  share: { sf: 'square.and.arrow.up', material: 'share' },
  trash: { sf: 'trash.fill', material: 'delete' },
  edit: { sf: 'pencil', material: 'edit' },
  copy: { sf: 'doc.on.doc', material: 'content-copy' },
  tag: { sf: 'tag.fill', material: 'label' },
  calendar: { sf: 'calendar', material: 'event' },
  warning: { sf: 'exclamationmark.triangle.fill', material: 'warning' },
  info: { sf: 'info.circle.fill', material: 'info' },
  shield: { sf: 'checkmark.shield.fill', material: 'verified-user' },
  eye: { sf: 'eye.fill', material: 'visibility' },
  eyeOff: { sf: 'eye.slash.fill', material: 'visibility-off' },
  text: { sf: 'text.alignleft', material: 'notes' },
  sparkles: { sf: 'sparkles', material: 'auto-awesome' },
  backup: { sf: 'arrow.down.doc.fill', material: 'save-alt' },
  restore: { sf: 'arrow.up.doc.fill', material: 'upload-file' },
  moon: { sf: 'moon.fill', material: 'dark-mode' },
  clock: { sf: 'clock.fill', material: 'schedule' },
  idCard: { sf: 'person.text.rectangle.fill', material: 'badge' },
  medical: { sf: 'cross.case.fill', material: 'medical-services' },
  finance: { sf: 'banknote.fill', material: 'account-balance' },
  legal: { sf: 'building.columns.fill', material: 'gavel' },
  insurance: { sf: 'umbrella.fill', material: 'health-and-safety' },
  receipt: { sf: 'receipt.fill', material: 'receipt-long' },
  other: { sf: 'tray.full.fill', material: 'inventory-2' },
} as const;

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
  inverse: 'textInverse',
  accent: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const;

export function Icon({
  name,
  size = 22,
  tone = 'primary',
  color,
  weight = 'medium',
  style,
  accessibilityLabel,
}: IconProps) {
  const { theme } = useUnistyles();
  const tint = color ?? theme.colors[toneToColor[tone]];
  const glyph = icons[name];
  const decorative = !accessibilityLabel;

  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={glyph.sf}
        size={size}
        tintColor={tint}
        weight={weight}
        style={[{ width: size, height: size }, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityElementsHidden={decorative}
        fallback={<MaterialIcons name={glyph.material} size={size} color={tint} />}
      />
    );
  }

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessibilityLabel={accessibilityLabel}
      accessible={!decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      <MaterialIcons name={glyph.material} size={size} color={tint} />
    </View>
  );
}
