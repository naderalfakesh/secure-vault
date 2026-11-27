import { ScrollView, View } from 'react-native';

import { Icon, Mark, Text } from '@/components/ui';
import { textScale } from '@/theme/tokens';

import { styles } from './LockHeader.styles';
import { MARK_SIZE } from '../../constants';

type LockHeaderProps = {
  compact: boolean;
  lockedOut: boolean;
  alerting: boolean;
  title: string;
  subtitle: string;
};

export function LockHeader({ compact, lockedOut, alerting, title, subtitle }: LockHeaderProps) {
  return (
    <ScrollView
      style={styles.heroScroll}
      contentContainerStyle={styles.hero(compact)}
      bounces={false}
      showsVerticalScrollIndicator={false}
      testID="lock-header"
    >
      <Mark size={MARK_SIZE} muted={lockedOut} glyph={lockedOut ? 'clock' : 'mark'} />
      <Text
        variant="title2"
        align="center"
        accessibilityRole="header"
        maxFontSizeMultiplier={textScale.barTitleMax}
        style={styles.title}
      >
        {title}
      </Text>
      <View
        style={styles.subtitle}
        accessible
        accessibilityRole={alerting ? 'alert' : undefined}
        accessibilityLiveRegion={alerting ? 'assertive' : 'polite'}
        accessibilityLabel={subtitle}
      >
        {alerting ? <Icon name="warning" size={16} tone="danger" /> : null}
        <Text
          variant="subheadline"
          tone={alerting ? 'danger' : 'secondary'}
          align="center"
          maxFontSizeMultiplier={textScale.barTitleMax}
          fit
          style={styles.subtitleText}
        >
          {subtitle}
        </Text>
      </View>
    </ScrollView>
  );
}
