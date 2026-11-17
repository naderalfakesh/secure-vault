import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { textScale } from '@/theme/tokens';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { useLargeText } from '../useLargeText';
import { tileColors } from './constants';
import { styles } from './ListRowContent.styles';
import type { ListRowContentProps } from './types';

/** The row's icon tile, title, subtitle, and value. */
export function ListRowContent({
  title,
  subtitle,
  value,
  icon,
  tint,
  titleTone,
  children,
}: ListRowContentProps) {
  const { theme } = useUnistyles();
  // At the accessibility sizes the value moves under the title, so neither
  // is squeezed into a sliver of the row.
  const stacked = useLargeText();
  const tile = tileColors[tint];

  // Row text stops at 2.4× (between AX2 and AX3) so a single word such as
  // "Immediately" always fits the row and wraps whole, never mid-word.
  const valueText = (
    <Text
      variant="body"
      tone="secondary"
      maxFontSizeMultiplier={textScale.rowMax}
      style={stacked ? null : styles.value}
    >
      {value}
    </Text>
  );

  return (
    <>
      {icon ? (
        <View style={[styles.tile, { backgroundColor: theme.colors[tile.fill] }]}>
          <Icon name={icon} size={18} color={theme.colors[tile.glyph]} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text variant="body" tone={titleTone} maxFontSizeMultiplier={textScale.rowMax}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="secondary" maxFontSizeMultiplier={textScale.rowMax}>
            {subtitle}
          </Text>
        ) : null}
        {value && stacked ? valueText : null}
      </View>
      {value && !stacked ? valueText : null}
      {children}
    </>
  );
}
