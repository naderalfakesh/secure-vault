import { Button } from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { useSession } from '@/features/session/SessionProvider';
import { t } from '@/i18n';

import { KeyInvalidatedBody, ReadFailedBody, RetryActions, UnavailableLayout } from './components';
import { useEraseVault } from './hooks/useEraseVault';
import { useRetryActions } from './hooks/useRetryActions';

/**
 * The device key or the PIN record could not be read. The
 * way on is to read them again: no erase, restore or settings, and nothing is
 * written. The session also tries again on its own each time the app returns
 * to the foreground. When the PIN record is gone although it was written and
 * the device key is there, the device key's own gate also opens setup, to add
 * a new PIN to the vault as it is. When that gate opens but the key itself
 * was invalidated (Android, screen lock or biometrics changed) with entries
 * left, or the key is gone while entries remain, nothing in the vault can be
 * decrypted again: the plain sentence and "Delete everything" are then the
 * only way on, behind a native confirmation.
 */
export function UnavailableScreen() {
  const { pinLost, keyInvalidated, error, biometry } = useSession();
  const stuck = keyInvalidated;
  const { trying, resetting, tryAgain, resetPin } = useRetryActions();
  const { erasing, eraseFailed, eraseAll } = useEraseVault();
  useAnnouncement(
    trying ? t('unavailable.trying') : resetting ? t('unavailable.pinLost.resetting') : null,
  );

  if (stuck) {
    return (
      <UnavailableLayout
        footer={
          <Button
            variant="destructive"
            label={t('settings.erase')}
            loading={erasing}
            loadingLabel={t('settings.erase.erasing')}
            onPress={eraseAll}
          />
        }
      >
        <KeyInvalidatedBody error={error} eraseFailed={eraseFailed} />
      </UnavailableLayout>
    );
  }

  return (
    <UnavailableLayout
      footer={
        <RetryActions
          pinLost={pinLost}
          trying={trying}
          resetting={resetting}
          onTryAgain={tryAgain}
          onResetPin={resetPin}
        />
      }
    >
      <ReadFailedBody pinLost={pinLost} biometry={biometry} error={error} />
    </UnavailableLayout>
  );
}
