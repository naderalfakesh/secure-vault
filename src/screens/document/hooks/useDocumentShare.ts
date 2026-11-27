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

export function useDocumentShare({ document, pageCount, busy, setBusy }: Options) {
  const toast = useToast();
  const mounted = useMountedRef();
  const { settings } = useSessionState();
  const { stepUp, withoutAutoLock, captureSession, markShareInterrupted } = useSessionActions();
  const [shareStep, setShareStep] = useState<ShareSheetStep | null>(null);
  const [confirming, setConfirming] = useState(false);
  const shareRun = useRef(0);

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
      copy?.discard();
      return;
    }
    if (mounted.current) {
      setShareStep(null);
      // iOS drops the system share sheet if opened while our confirmation Modal is still closing.
      await wait(SHEET_CLOSE_MS);
    }
    // Re-check session before presenting so the share sheet never opens over the lock screen.
    if (!mounted.current || !(await session.confirm()) || !mounted.current) {
      copy?.discard();
      if (!session.current()) {
        // Lock sweep may have raced ahead of the write; sweep again unless a new session unlocked.
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
      // Android pauses JS timers while the chooser is open; schedule native expiry so a lingering chooser can't read the copy.
      const limit = settings.autoLockSeconds;
      if (Platform.OS === 'android' && limit >= 0) {
        copy.expireAfter(Math.max(pause.maxAwayMs ?? 0, limit * 1000));
      }
      // Pause auto-lock for system share UI, scoped to this session so a hung sheet cannot exempt a later session.
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
