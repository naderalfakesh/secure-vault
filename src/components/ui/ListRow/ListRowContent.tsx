import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { textScale } from '@/theme/tokens';

import { useLargeText } from '../hooks/useLargeText';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { tileColors } from './constants';
import { styles } from './ListRowContent.styles';
import type { ListRowContentProps } from './types';

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
  const stacked = useLargeText();
  const tile = tileColors[tint];

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
