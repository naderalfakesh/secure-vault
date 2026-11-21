import { ActivityIndicator, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { Button, FileCard, Icon, Sheet, Text, useAnnouncement } from '@/components/ui';
import { biometryIcon } from '@/features/auth/lockCopy';

import { confirmShareLabel, shareText } from '../shareCopy';
import { styles } from './ShareSheet.styles';
import type { ShareSheetProps } from './types';

/**
 * The share warning and preparing step. Every share
 * starts here; the system share sheet opens only after this sheet closes.
 */
export function ShareSheet({
  step,
  fileName,
  fileMeta,
  fileIcon,
  confirmFirst,
  biometry,
  busy,
  onShare,
  onCancel,
}: ShareSheetProps) {
  const { theme } = useUnistyles();
  const preparing = step === 'preparing';
  useAnnouncement(preparing ? shareText('preparing.announce') : null);

  return (
    <Sheet visible={step !== null} onClose={onCancel} dismissable={!busy}>
      {preparing ? (
        <View style={styles.body}>
          <Text variant="title3" accessibilityRole="header">
            {shareText('preparing.title')}
          </Text>
          <View style={styles.progress} accessible accessibilityLiveRegion="polite">
            <ActivityIndicator color={theme.colors.primary} />
            <Text variant="callout" tone="secondary" style={styles.progressLabel}>
              {shareText('preparing.label')}
            </Text>
          </View>
          <Button label={shareText('preparing.cancel')} variant="secondary" onPress={onCancel} />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.iconTile}>
            <Icon name="share" size={22} tone="accent" />
          </View>
          <Text variant="title2" accessibilityRole="header">
            {shareText('warning.title')}
          </Text>
          <Text variant="callout" tone="secondary">
            {shareText('warning.body')}
          </Text>
          <FileCard name={fileName} meta={fileMeta} icon={fileIcon} />
          <Button
            label={confirmFirst ? confirmShareLabel(biometry) : shareText('warning.share')}
            icon={confirmFirst ? biometryIcon(biometry) : undefined}
            loading={busy}
            onPress={onShare}
          />
          <Button
            label={shareText('warning.cancel')}
            variant="plain"
            onPress={onCancel}
            disabled={busy}
          />
        </View>
      )}
    </Sheet>
  );
}
