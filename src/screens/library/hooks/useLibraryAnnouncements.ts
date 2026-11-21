import { useAnnouncement } from '@/components/ui';
import { t } from '@/i18n';

type State = {
  loading: boolean;
  showSkeleton: boolean;
  error: string | null;
  selecting: boolean;
  selectedCount: number;
};

/** What the Library says out loud as its state changes. */
export function useLibraryAnnouncements({
  loading,
  showSkeleton,
  error,
  selecting,
  selectedCount,
}: State) {
  useAnnouncement(loading && showSkeleton ? t('library.loading') : null);
  // The load error replaces the screen; iOS does not speak an alert role by itself.
  useAnnouncement(!loading && error ? t('library.loadFailed.title') : null);
  // The live region on the count speaks on Android only; iOS is told directly.
  useAnnouncement(selecting ? t('library.selected', { count: selectedCount }) : null);
}
