import type { IconName } from '@/components/ui';
import { DocumentCategory, DocumentCategoryLabels } from '@/types';

export const categoryIcons: Record<DocumentCategory, IconName> = {
  [DocumentCategory.ID]: 'idCard',
  [DocumentCategory.MEDICAL]: 'medical',
  [DocumentCategory.FINANCE]: 'finance',
  [DocumentCategory.LEGAL]: 'legal',
  [DocumentCategory.INSURANCE]: 'insurance',
  [DocumentCategory.RECEIPTS]: 'receipt',
  [DocumentCategory.OTHER]: 'other',
};

export const allCategories = Object.values(DocumentCategory);

export function categoryLabel(category: DocumentCategory): string {
  return DocumentCategoryLabels[category];
}
