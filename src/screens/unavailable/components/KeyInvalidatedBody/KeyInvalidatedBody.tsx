import { Text } from '@/components/ui';
import { t } from '@/i18n';

type KeyInvalidatedBodyProps = {
  error: string | null;
  eraseFailed: boolean;
};

export function KeyInvalidatedBody({ error, eraseFailed }: KeyInvalidatedBodyProps) {
  return (
    <>
      <Text variant="body" tone="secondary" align="center">
        {error ?? t('unavailable.keyMissing.body')}
      </Text>
      <Text variant="subheadline" tone="tertiary" align="center">
        {t('unavailable.keyInvalidated.hint')}
      </Text>
      {eraseFailed ? (
        <Text variant="subheadline" tone="danger" align="center">
          {t('unavailable.keyInvalidated.failed')}
        </Text>
      ) : null}
    </>
  );
}
