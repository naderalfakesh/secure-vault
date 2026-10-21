import type { IconName } from '@/components/ui';
import { type StringKey, t } from '@/i18n';
import { DocumentCategory } from '@/types';

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

const categoryKeys: Record<DocumentCategory, StringKey> = {
  [DocumentCategory.ID]: 'library.category.id',
  [DocumentCategory.MEDICAL]: 'library.category.medical',
  [DocumentCategory.FINANCE]: 'library.category.finance',
  [DocumentCategory.LEGAL]: 'library.category.legal',
  [DocumentCategory.INSURANCE]: 'library.category.insurance',
  [DocumentCategory.RECEIPTS]: 'library.category.receipts',
  [DocumentCategory.OTHER]: 'library.category.other',
};

export function categoryLabel(category: DocumentCategory): string {
  return t(categoryKeys[category]);
}
