import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Button,
  FileCard,
  Icon,
  InlineAlert,
  PassphraseField,
  ProgressBlock,
  Sheet,
  Text,
  useToast,
} from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { useSession } from '@/features/session/SessionProvider';
import {
  backupService,
  describeBackupErrorPlainly,
  type RestoreProgress,
} from '@/services/BackupService';
import { t, tp } from '@/i18n';

import {
  backupCopy as copy,
  backupFileMeta,
  restoreOutcome,
  restoreProgressLabel,
  type RestoreOutcome,
} from './backupCopy';

export interface PickedBackup {
  uri: string;
  name: string;
  /** Entries the header declares, the check entry not counted. */
  entries: number;
  created: string;
}

type Stage =
  | { name: 'inspect'; outcome: Extract<RestoreOutcome, { kind: 'inspect' }> | null }
  | { name: 'running'; progress: RestoreProgress }
  | { name: 'outcome'; outcome: Exclude<RestoreOutcome, { kind: 'inspect' }> };

export type RestoreSheetProps = {
  /**
   * The picked file after its header was read; null closes the sheet. The hub
   * keys the sheet by the file, so each file starts at the inspect step.
   */
  backup: PickedBackup | null;
  /** The sheet was closed: the hub drops the picker's copy. */
  onClose: () => void;
  /** BACKUP_INVALID: close and open the picker again. */
  onChooseAnother: () => void;
  /** The vault was replaced and the index reloaded. */
  onRestored: (entries: number) => void;
};

/**
 * The restore sheet (handover §6 J6, §7.1): Inspect → Checking → Restoring →
 * outcome. Checking leaves the vault untouched and may be cancelled (F2); the
 * first Restoring event is the wipe boundary (F6), after which there is no
 * control and nothing says the vault is unchanged.
 *
 * A restore is never stopped by the lock: it keeps running with the screen
 * gone so the vault is never left half replaced, and reports its outcome after
 * the next unlock. The service refuses any other backup work until it ends.
 */
export function RestoreSheet({ backup, onClose, onChooseAnother, onRestored }: RestoreSheetProps) {
  const toast = useToast();
  const { captureSession, postNotice } = useSession();
  const [passphrase, setPassphrase] = useState('');
  const [stage, setStage] = useState<Stage>({ name: 'inspect', outcome: null });
  const [cancelling, setCancelling] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const running = stage.name === 'running';
  const wiped = running && stage.progress.wiped;

  const restore = useCallback(async () => {
    if (!backup || !passphrase) return;
    const session = captureSession();
    const stillHere = () => mounted.current && session.current();
    setCancelling(false);
    setStage({
      name: 'running',
      progress: { phase: 'verify', done: 0, total: backup.entries + 1, wiped: false },
    });
    try {
      const entries = await backupService.restoreBackup(backup.uri, passphrase, (event) => {
        if (mounted.current) setStage({ name: 'running', progress: event });
      });
      backupService.discardPickedFile(backup.uri);
      const message = t('backup.restore.done', { count: entries });
      if (stillHere()) {
        setPassphrase('');
        toast.show({ message, tone: 'success' });
        onRestored(entries);
      } else {
        postNotice({ message, tone: 'success' });
      }
    } catch (error) {
      if (stillHere()) {
        const outcome = restoreOutcome(error);
        setStage(
          outcome.kind === 'inspect' ? { name: 'inspect', outcome } : { name: 'outcome', outcome },
        );
      } else {
        backupService.discardPickedFile(backup.uri);
        postNotice({
          message: describeBackupErrorPlainly(error, copy['restore.stoppedBehindLock']),
          tone: 'danger',
        });
      }
    } finally {
      if (mounted.current) setCancelling(false);
    }
  }, [backup, passphrase, captureSession, postNotice, toast, onRestored]);

  const cancel = useCallback(() => {
    if (backupService.cancelRestore()) setCancelling(true);
  }, []);

  // The Cancel control and the point of no return are spoken when they appear.
  useAnnouncement(
    running && !wiped ? `${copy['restore.unchanged']} ${copy['restore.cancelAvailable']}` : null,
  );

  const inspectOutcome = stage.name === 'inspect' ? stage.outcome : null;

  return (
    <Sheet
      visible={backup !== null}
      onClose={onClose}
      title={
        stage.name === 'outcome' && stage.outcome.kind === 'partial'
          ? undefined
          : copy['restore.title']
      }
      dismissable={!running}
    >
      {backup ? (
        <View style={styles.body}>
          {stage.name === 'inspect' ? (
            <>
              <FileCard name={backup.name} meta={backupFileMeta(backup.entries, backup.created)} />
              <InlineAlert tone="danger" message={copy['restore.warning']} announce={false} />
              <PassphraseField
                label={copy['restore.passphrase']}
                placeholder={copy['restore.placeholder']}
                value={passphrase}
                onChangeText={setPassphrase}
                error={inspectOutcome?.field ? inspectOutcome.message : null}
                selectTextOnFocus
                returnKeyType="go"
                onSubmitEditing={() => void restore()}
              />
              {inspectOutcome && !inspectOutcome.field ? (
                <InlineAlert tone={inspectOutcome.tone} message={inspectOutcome.message} announce />
              ) : null}
              <Text variant="footnote" tone="secondary">
                {copy['restore.explainer']}
              </Text>
              <Button
                label={copy['restore.button']}
                variant="destructive"
                onPress={() => void restore()}
                disabled={!passphrase}
              />
              <Button label={copy['restore.cancel']} variant="plain" onPress={onClose} />
            </>
          ) : null}

          {stage.name === 'running' ? (
            <>
              <FileCard name={backup.name} meta={tp('format.entries', backup.entries)} />
              <ProgressBlock
                label={restoreProgressLabel(
                  stage.progress.phase === 'import' ? 'import' : 'verify',
                  stage.progress.done,
                  stage.progress.total,
                )}
                detail={copy[wiped ? 'restore.restoring.step' : 'restore.checking.step']}
                progress={stage.progress.total ? stage.progress.done / stage.progress.total : 0}
              />
              {wiped ? (
                <InlineAlert
                  tone="warning"
                  icon="lock"
                  title={copy['restore.cantStop.title']}
                  message={copy['restore.cantStop.body']}
                  announce
                  testID="restore-cant-stop"
                />
              ) : (
                <>
                  <InlineAlert tone="success" icon="shield" message={copy['restore.unchanged']} />
                  <Button
                    label={copy['restore.cancel']}
                    variant="secondary"
                    onPress={cancel}
                    loading={cancelling}
                    loadingLabel={copy['restore.cancelling']}
                  />
                </>
              )}
            </>
          ) : null}

          {stage.name === 'outcome' ? (
            <OutcomeView
              outcome={stage.outcome}
              backup={backup}
              onRestoreAgain={() => void restore()}
              onChooseAnother={onChooseAnother}
              onClose={onClose}
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

function OutcomeView({
  outcome,
  backup,
  onRestoreAgain,
  onChooseAnother,
  onClose,
}: {
  outcome: Exclude<RestoreOutcome, { kind: 'inspect' }>;
  backup: PickedBackup;
  onRestoreAgain: () => void;
  onChooseAnother: () => void;
  onClose: () => void;
}) {
  if (outcome.kind === 'partial') {
    return (
      <>
        <View style={styles.partialIcon}>
          <Icon name="warning" size={24} tone="danger" />
        </View>
        <Text variant="title2" accessibilityRole="header">
          {copy['restore.partial.title']}
        </Text>
        <View accessible accessibilityRole="alert" accessibilityLabel={outcome.message}>
          <Text variant="callout" tone="secondary">
            {outcome.message}
          </Text>
        </View>
        <FileCard
          name={backup.name}
          meta={
            outcome.stoppedAt
              ? t('backup.restore.stoppedAt', {
                  entry: outcome.stoppedAt.entry,
                  total: outcome.stoppedAt.total,
                })
              : undefined
          }
        />
        <Button label={copy['restore.again']} icon="refresh" onPress={onRestoreAgain} />
        <Button label={copy['restore.close']} variant="plain" onPress={onClose} />
      </>
    );
  }
  return (
    <>
      <InlineAlert tone="danger" message={outcome.message} />
      {outcome.kind === 'index' ? (
        <Button label={copy['restore.again']} icon="refresh" onPress={onRestoreAgain} />
      ) : outcome.kind === 'chooseFile' ? (
        <Button
          label={copy['restore.chooseAnother']}
          variant="secondary"
          onPress={onChooseAnother}
        />
      ) : (
        <Button label={copy['restore.close']} variant="secondary" onPress={onClose} />
      )}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  partialIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.dangerMuted,
  },
}));
