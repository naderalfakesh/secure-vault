import { Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAnnouncement } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { PageStage } from '@/features/viewer/PageStage';
import { ShareSheet } from '@/features/viewer/ShareSheet';
import { useDelayed } from '@/hooks/useDelayed';
import { useMountedRef } from '@/hooks/useMountedRef';
import { t } from '@/i18n';

import {
  DetailsSheet,
  DocumentDetails,
  EditDetails,
  InterruptedBanner,
  StagePlaceholder,
  ViewerBottomBar,
  ViewerFailure,
  ViewerTopBar,
} from './components';
import {
  BANNER_OFFSET,
  BANNER_OFFSET_WITH_CHROME,
  PLACEHOLDER_DELAY_MS,
  SHEET_CLOSE_MS,
} from './constants';
import { styles } from './DocumentScreen.styles';
import { fileIcon, pageLine, shareFileMeta } from './helpers';
import { useDocumentActions } from './hooks/useDocumentActions';
import { useDocumentEditor } from './hooks/useDocumentEditor';
import { useDocumentShare } from './hooks/useDocumentShare';
import { useInterruptedShare } from './hooks/useInterruptedShare';
import { useRevealNumber } from './hooks/useRevealNumber';
import { useViewerDocument } from './hooks/useViewerDocument';
import { goToLibrary } from './navigation';
import type { ViewerBusy } from './types';

export function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { settings, biometry } = useSession();
  const { document, setDocument, loading, failure, pages, fields } = useViewerDocument(id);
  const [page, setPage] = useState(0);
  const [chrome, setChrome] = useState(true);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState<ViewerBusy>(null);
  const mounted = useMountedRef();
  const { revealNumber, toggleReveal } = useRevealNumber();
  const editor = useDocumentEditor(document, setDocument);
  const sharing = useDocumentShare({ document, pageCount: pages.length, busy, setBusy });
  const { openShare } = sharing;
  const banner = useInterruptedShare(document, openShare);
  const closeDetails = useCallback(() => setDetails(false), []);
  const actions = useDocumentActions({ document, setDocument, pages, setBusy, closeDetails });

  // A slow page gets a placeholder and a spinner, not a blank stage.
  const slow = useDelayed(loading, PLACEHOLDER_DELAY_MS);
  useAnnouncement(slow ? t('viewer.opening', { number: page + 1 }) : null);

  // From the details sheet: close it first, one sheet at a time.
  const shareFromDetails = useCallback(() => {
    setDetails(false);
    setTimeout(() => {
      if (mounted.current) openShare();
    }, SHEET_CLOSE_MS);
  }, [openShare, mounted]);

  if (failure) return <ViewerFailure failure={failure} onBack={goToLibrary} />;

  return (
    <View style={styles.root}>
      {/* iOS takes the status bar style from the screen's view controller
        (UIViewControllerBasedStatusBarAppearance), so the native stack sets it;
        StatusBar covers Android. */}
      <Stack.Screen options={{ headerShown: false, statusBarStyle: 'light' }} />
      <StatusBar style="light" />

      {document && pages.length > 0 ? (
        <PageStage
          pages={pages}
          title={document.title}
          index={page}
          onIndexChange={setPage}
          onTap={() => setChrome((value) => !value)}
          onDismiss={goToLibrary}
        />
      ) : (
        <StagePlaceholder loading={loading} slow={slow} />
      )}

      {chrome ? (
        <ViewerTopBar
          insetTop={insets.top}
          title={document ? document.title : null}
          pageLine={pageLine(page, pages.length)}
          shareDisabled={!document || pages.length === 0 || busy === 'share'}
          moreDisabled={!document}
          onBack={goToLibrary}
          onShare={openShare}
          onMore={() => setDetails(true)}
        />
      ) : null}

      {banner.bannerMark ? (
        <InterruptedBanner
          top={insets.top + (chrome ? BANNER_OFFSET_WITH_CHROME : BANNER_OFFSET)}
          onShareAgain={banner.shareAgain}
          onDismiss={banner.dismissBanner}
        />
      ) : null}

      {chrome && document ? (
        <ViewerBottomBar
          insetBottom={insets.bottom}
          pages={pages}
          page={page}
          onPageChange={setPage}
          onDetails={() => setDetails(true)}
        />
      ) : null}

      {document ? (
        <ShareSheet
          step={sharing.shareStep}
          fileName={document.title}
          fileMeta={shareFileMeta(document, pages.length)}
          fileIcon={fileIcon(document.fileType)}
          confirmFirst={settings.biometricsForShare}
          biometry={biometry}
          busy={sharing.confirming || busy === 'share'}
          onShare={sharing.share}
          onCancel={sharing.cancelShare}
        />
      ) : null}

      {document ? (
        <DetailsSheet
          visible={details}
          editing={editor.editing}
          onClose={() => {
            setDetails(false);
            editor.closeEditor();
          }}
          onCancelEdit={editor.closeEditor}
        >
          {editor.editing ? (
            <EditDetails
              draft={editor.draft}
              titleError={editor.titleError}
              onChange={editor.changeDraft}
              onSave={editor.saveEdits}
            />
          ) : (
            <DocumentDetails
              document={document}
              fields={fields}
              pageCount={pages.length}
              busy={busy}
              revealNumber={revealNumber}
              onToggleReveal={toggleReveal}
              onEdit={editor.openEditor}
              onReadAgain={actions.runOcr}
              onCopyText={actions.copyText}
              onShare={shareFromDetails}
              onDelete={actions.remove}
            />
          )}
        </DetailsSheet>
      ) : null}
    </View>
  );
}
