import { Text } from '@/components/ui';
import type { ExtractedField, Document } from '@/types';

import { detailsFooter, expiryField } from '../../helpers';
import type { ViewerBusy } from '../../types';
import { DetailsActions } from '../DetailsActions';
import { DetailsHeader } from '../DetailsHeader';
import { FoundFields } from '../FoundFields';
import { NoTextNotice } from '../NoTextNotice';
import { styles } from './DocumentDetails.styles';

type DocumentDetailsProps = {
  document: Document;
  fields: readonly ExtractedField[];
  pageCount: number;
  busy: ViewerBusy;
  revealNumber: boolean;
  onToggleReveal: () => void;
  onEdit: () => void;
  onReadAgain: () => void;
  onCopyText: () => void;
  onShare: () => void;
  onDelete: () => void;
};

export function DocumentDetails({
  document,
  fields,
  pageCount,
  busy,
  revealNumber,
  onToggleReveal,
  onEdit,
  onReadAgain,
  onCopyText,
  onShare,
  onDelete,
}: DocumentDetailsProps) {
  return (
    <>
      <DetailsHeader document={document} expires={expiryField(fields)} onEdit={onEdit} />
      <FoundFields
        fields={fields}
        tags={document.tags}
        revealNumber={revealNumber}
        onToggleReveal={onToggleReveal}
      />
      {document.ocrText ? null : (
        <NoTextNotice
          reading={busy === 'ocr'}
          disabled={pageCount === 0}
          onReadAgain={onReadAgain}
        />
      )}
      <DetailsActions
        hasText={Boolean(document.ocrText)}
        shareDisabled={pageCount === 0 || busy === 'share'}
        deleteDisabled={busy === 'delete'}
        onCopyText={onCopyText}
        onShare={onShare}
        onDelete={onDelete}
      />
      <Text variant="footnote" tone="tertiary" style={styles.footer}>
        {detailsFooter(document, pageCount)}
      </Text>
    </>
  );
}
