import { View } from 'react-native';

import { Banner } from '@/components/ui';
import { shareText } from '@/features/viewer/shareCopy';

import { styles } from './InterruptedBanner.styles';

type InterruptedBannerProps = {
  /** Distance from the top of the screen. */
  top: number;
  onShareAgain: () => void;
  onDismiss: () => void;
};

/** A share the lock cut short: say so and offer it again. */
export function InterruptedBanner({ top, onShareAgain, onDismiss }: InterruptedBannerProps) {
  return (
    <View style={[styles.bannerSlot, { top }]} pointerEvents="box-none">
      <Banner
        icon="lock"
        lead={shareText('interrupted.lead')}
        message={shareText('interrupted.body')}
        actions={[{ label: shareText('interrupted.again'), onPress: onShareAgain }]}
        onDismiss={onDismiss}
      />
    </View>
  );
}
