import { ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, FileCard, Icon, Sheet, Text } from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { biometryIcon } from '@/features/auth/lockCopy';

import type { BiometryType } from '../../../modules/expo-vault';
import { confirmShareLabel, shareText } from './shareCopy';

export type ShareSheetStep = 'warning' | 'preparing';

export type ShareSheetProps = {
  /** null hides the sheet. */
  step: ShareSheetStep | null;
  /** The one document being shared (handover §11.12). */
  fileName: string;
  fileMeta: string;
  fileIcon: 'document' | 'pdf' | 'image';
  /** Confirm before sharing: the primary button asks for biometrics first. */
  confirmFirst: boolean;
  biometry: BiometryType;
  /** True while the biometric step-up or the copy is under way. */
  busy: boolean;
  onShare: () => void;
  /** Warning: nothing was made. Preparing: the partial copy is removed. */
  onCancel: () => void;
};

/**
 * J5 share warning and preparing step (handover §6 J5, §7.4). Every share
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

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentMuted,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  progressLabel: {
    flex: 1,
  },
}));
