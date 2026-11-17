import { Button } from '@/components/ui';
import { t } from '@/i18n';

export type RetryActionsProps = {
  pinLost: boolean;
  trying: boolean;
  resetting: boolean;
  onTryAgain: () => void;
  onResetPin: () => void;
};

/** "Try again", and "Add a new PIN" first when only the PIN record is gone. */
export function RetryActions({
  pinLost,
  trying,
  resetting,
  onTryAgain,
  onResetPin,
}: RetryActionsProps) {
  return (
    <>
      {pinLost ? (
        <Button
          label={t('unavailable.pinLost.reset')}
          icon="lock"
          loading={resetting}
          loadingLabel={t('unavailable.pinLost.resetting')}
          disabled={trying}
          onPress={onResetPin}
        />
      ) : null}
      <Button
        variant={pinLost ? 'secondary' : 'primary'}
        label={t('unavailable.tryAgain')}
        icon="refresh"
        loading={trying}
        loadingLabel={t('unavailable.trying')}
        disabled={resetting}
        onPress={onTryAgain}
      />
    </>
  );
}
