import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';

import { Group, ListRow } from '@/components/ui';
import {
  type BiometricAvailability,
  biometricUnavailableReason,
} from '@/features/auth/biometricAvailability';
import { biometryIcon, biometryName } from '@/features/auth/lockCopy';
import type { SessionActions, SessionState } from '@/features/session/SessionProvider';
import { autoLockLabel, type SecuritySettings } from '@/features/session/settings';
import { t } from '@/i18n';

type SecurityGroupProps = {
  settings: SecuritySettings;
  updateSettings: SessionActions['updateSettings'];
  biometry: SessionState['biometry'];
  /** Null until the device has answered. */
  biometrics: BiometricAvailability | null;
  onLock: () => void;
};

/** Unlock, auto-lock, privacy cover, share confirmation, PIN and Lock now. */
export function SecurityGroup({
  settings,
  updateSettings,
  biometry,
  biometrics,
  onLock,
}: SecurityGroupProps) {
  const biometricReason = biometrics ? biometricUnavailableReason(biometrics) : null;

  return (
    <Group header={t('settings.group.security')} separatorInset="content">
      {biometrics && biometrics.state !== 'unavailable' ? (
        <ListRow
          icon={biometryIcon(biometrics.kind)}
          title={
            Platform.OS === 'ios' ? biometryName(biometrics.kind) : t('settings.biometricUnlock')
          }
          subtitle={biometricReason ?? t('settings.biometricUnlock.subtitle')}
          disabled={biometrics.state !== 'available'}
          toggle={{
            value: biometrics.state === 'available' && settings.biometricUnlock,
            onValueChange: (value) => void updateSettings({ biometricUnlock: value }),
          }}
        />
      ) : null}
      {biometrics?.state === 'denied' ? (
        <ListRow
          icon="settings"
          tint="neutral"
          title={t('settings.openSettings')}
          onPress={() => void Linking.openSettings().catch(() => {})}
          trailing={null}
        />
      ) : null}
      <ListRow
        icon="clock"
        title={t('settings.autoLock')}
        value={autoLockLabel(settings.autoLockSeconds)}
        onPress={() => router.push('/settings/auto-lock')}
      />
      <ListRow
        icon="eyeOff"
        title={t('settings.privacyCover')}
        subtitle={t('settings.privacyCover.subtitle')}
        toggle={{
          value: settings.privacyScreen,
          onValueChange: (value) => void updateSettings({ privacyScreen: value }),
        }}
      />
      {biometry !== 'none' ? (
        <ListRow
          icon="share"
          title={t('settings.confirmShare')}
          subtitle={t('settings.confirmShare.subtitle', { biometry: biometryName(biometry) })}
          toggle={{
            value: settings.biometricsForShare,
            onValueChange: (value) => void updateSettings({ biometricsForShare: value }),
          }}
        />
      ) : null}
      <ListRow
        icon="key"
        title={t('settings.changePin')}
        onPress={() => router.push('/settings/change-pin')}
      />
      <ListRow icon="lock" title={t('settings.lockNow')} onPress={onLock} trailing={null} />
    </Group>
  );
}
