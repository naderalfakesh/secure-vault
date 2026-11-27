import { Button, useAnnouncement } from '@/components/ui';
import { useSessionState } from '@/features/session/SessionProvider';
import { t } from '@/i18n';

import { KeyInvalidatedBody, ReadFailedBody, RetryActions, UnavailableLayout } from './components';
import { useEraseVault } from './hooks/useEraseVault';
import { useRetryActions } from './hooks/useRetryActions';

// Fail-closed recovery screen: no writes, restore, or settings until key/PIN state resolves (or explicit erase if invalidated).
export function UnavailableScreen() {
  const { pinLost, keyInvalidated, error, biometry } = useSessionState();
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
