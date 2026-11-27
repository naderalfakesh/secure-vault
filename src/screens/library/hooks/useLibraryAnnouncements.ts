import { useAnnouncement } from '@/components/ui';
import { t } from '@/i18n';

type State = {
  loading: boolean;
  showSkeleton: boolean;
  error: string | null;
  selecting: boolean;
  selectedCount: number;
};

export function useLibraryAnnouncements({
  loading,
  showSkeleton,
  error,
  selecting,
  selectedCount,
}: State) {
  useAnnouncement(loading && showSkeleton ? t('library.loading') : null);
  useAnnouncement(!loading && error ? t('library.loadFailed.title') : null);
  useAnnouncement(selecting ? t('library.selected', { count: selectedCount }) : null);
}
