import * as Sharing from 'expo-sharing';
import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useToast } from '@/components/ui';
import { sharePause, useSessionActions, useSessionState } from '@/features/session/SessionProvider';
import { shareText } from '@/features/viewer/shareCopy';
import type { ShareSheetStep } from '@/features/viewer/ShareSheet';
import { useMountedRef } from '@/hooks/useMountedRef';
import { documentService } from '@/services/DocumentService';
import type { Document } from '@/types';
import { wait } from '@/utils/time';

import { PREPARING_DELAY_MS, SHEET_CLOSE_MS } from '../constants';
import { shareFileType } from '../helpers';
import type { ViewerBusy } from '../types';

type Options = {
  document: Document | null;
  pageCount: number;
  busy: ViewerBusy;
  setBusy: Dispatch<SetStateAction<ViewerBusy>>;
};

/** The share warning, the decrypted copy and the system share sheet. */
export function useDocumentShare({ document, pageCount, busy, setBusy }: Options) {
  const toast = useToast();
  const mounted = useMountedRef();
  const { settings } = useSessionState();
  const { stepUp, withoutAutoLock, captureSession, markShareInterrupted } = useSessionActions();
  const [shareStep, setShareStep] = useState<ShareSheetStep | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Bumped by every share and by Cancel: a copy whose run is no longer the
  // current one was cancelled and is removed on arrival.
  const shareRun = useRef(0);

  // Every share starts at the warning sheet; nothing is
  // decrypted until it is confirmed.
  const openShare = useCallback(() => {
    if (!document || pageCount === 0 || busy === 'share') return;
    setShareStep('warning');
  }, [document, pageCount, busy]);

  const cancelShare = useCallback(() => {
    if (confirming) return;
    if (busy === 'share') {
      shareRun.current += 1;
      setBusy(null);
    }
    setShareStep(null);
  }, [busy, confirming, setBusy]);

  const share = useCallback(async () => {
    if (!document || busy === 'share' || confirming) return;
    const session = captureSession();
    if (settings.biometricsForShare) {
      setConfirming(true);
      const confirmed = await stepUp();
      if (mounted.current) setConfirming(false);
      if (!confirmed) {
        if (mounted.current) toast.show({ message: shareText('warning.notConfirmed') });
        return;
      }
    }
    const run = ++shareRun.current;
    setBusy('share');
    const preparing = setTimeout(() => {
      if (mounted.current && run === shareRun.current) setShareStep('preparing');
    }, PREPARING_DELAY_MS);
    const copy = await documentService.prepareShareFile(document.id).catch(() => null);
    clearTimeout(preparing);
    if (run !== shareRun.current) {
      // Cancel already closed the sheet; the copy made meanwhile goes too.
      copy?.discard();
      return;
    }
    if (mounted.current) {
      setShareStep(null);
      // The share sheet cannot open over a sheet that is still closing.
      await wait(SHEET_CLOSE_MS);
    }
    // The decrypted copy must not reach a share sheet once the vault has
    // locked or this screen is gone: the sheet would open over the lock screen.
    if (!mounted.current || !(await session.confirm()) || !mounted.current) {
      copy?.discard();
      if (!session.current()) {
        // The lock sweep may have run before the copy was written; sweep again
        // unless a new session has already been unlocked.
        if (!captureSession().current()) documentService.clearCache().catch(() => {});
        markShareInterrupted(document.id);
      }
      if (mounted.current) setBusy(null);
      return;
    }
    if (!copy) {
      setBusy(null);
      toast.show({ message: shareText('failed'), tone: 'danger' });
      return;
    }
    try {
      const pause = sharePause();
      // Android's chooser pauses the app and its JavaScript timers; a native
      // timer deletes the copy once the time away could have locked the vault,
      // so a target picked later from a chooser left open reads nothing.
      const limit = settings.autoLockSeconds;
      if (Platform.OS === 'android' && limit >= 0) {
        copy.expireAfter(Math.max(pause.maxAwayMs ?? 0, limit * 1000));
      }
      // The share sheet is system UI; the vault must not lock behind it.
      // The pause ends with the session even when the sheet never settles
      // (Android blocked the chooser, or iOS never reports a sheet the lock
      // dismissed), so it cannot excuse a later session's time away.
      await withoutAutoLock(
        () =>
          Promise.race([
            Sharing.shareAsync(copy.uri, {
              dialogTitle: document.title,
              ...shareFileType(document.fileType),
            }),
            session.ended(),
          ]),
        pause,
      );
      if (!session.current()) markShareInterrupted(document.id);
    } catch {
      // Sheet dismissed or sharing unavailable; the copy is discarded either way.
    } finally {
      copy.discard();
      if (mounted.current) setBusy(null);
    }
  }, [
    document,
    busy,
    confirming,
    settings.biometricsForShare,
    settings.autoLockSeconds,
    stepUp,
    toast,
    withoutAutoLock,
    captureSession,
    markShareInterrupted,
    setBusy,
    mounted,
  ]);

  return { shareStep, confirming, openShare, cancelShare, share };
}
