import { Button, InlineAlert } from '@/components/ui';

import { backupCopy as copy } from '../../../backupCopy';

type ExportFailedProps = {
  message: string;
  onRetry: () => void;
  onClose: () => void;
};

export function ExportFailed({ message, onRetry, onClose }: ExportFailedProps) {
  return (
    <>
      <InlineAlert tone="danger" message={message} />
      <Button label={copy['create.retry']} onPress={onRetry} />
      <Button label={copy['create.close']} variant="plain" onPress={onClose} />
    </>
  );
}
