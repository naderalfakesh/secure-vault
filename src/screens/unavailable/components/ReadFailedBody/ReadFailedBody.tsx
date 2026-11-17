import { Text } from '@/components/ui';
import type { SessionContextValue } from '@/features/session/SessionProvider';
import { t } from '@/i18n';

import { pinLostHint } from '../../helpers';

export type ReadFailedBodyProps = {
  pinLost: boolean;
  biometry: SessionContextValue['biometry'];
  error: string | null;
};

/** The key or the PIN record could not be read; a lost PIN record names the gate that adds a new one. */
export function ReadFailedBody({ pinLost, biometry, error }: ReadFailedBodyProps) {
  return (
    <>
      <Text variant="body" tone="secondary" align="center">
        {pinLost ? t('unavailable.pinLost.body') : t('unavailable.body')}
      </Text>
      <Text variant="subheadline" tone="tertiary" align="center">
        {pinLost ? pinLostHint(biometry) : t('unavailable.hint')}
      </Text>
      {pinLost && error ? (
        <Text variant="subheadline" tone="danger" align="center">
          {error}
        </Text>
      ) : null}
    </>
  );
}
