import { useCallback, useEffect, useRef, useState } from 'react';
import * as Sharing from 'expo-sharing';
import { Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Button,
  Icon,
  InlineAlert,
  PassphraseField,
  ProgressBlock,
  Sheet,
  StrengthMeter,
  Text,
  useToast,
} from '@/components/ui';
import { sharePause, useSession } from '@/features/session/SessionProvider';
import {
  backupService,
  describeBackupError,
  MIN_PASSPHRASE_LENGTH,
  passphraseProblem,
} from '@/services/BackupService';
import { t } from '@/i18n';
import { formatFileSize } from '@/utils/format';

import { backupCopy as copy } from './backupCopy';
import { recordLastBackup } from './lastBackup';
import { saveBackupToDevice } from './saveToDevice';

// The vault locked while the share sheet was still open or never appeared.
const SHARE_INTERRUPTED = copy['create.shareInterrupted'];

// Where a finished backup goes. Android offers the system save screen first,
// for a phone without a Files app; iOS's share sheet has Save to Files.
type Destination = 'share' | 'save';
const CAN_SAVE = () => Platform.OS === 'android';

// The vault locked while the save screen was up or the copy was being written.
const SAVE_INTERRUPTED = copy['create.saveInterrupted'];

// Shown once the vault is unlocked; it names nothing about the vault.
const EXPORT_STOPPED = copy['create.exportStopped'];

// Codes whose own sentence says more than the sheet's general failure line.
const SPECIFIC_EXPORT_ERRORS = new Set([
  'BACKUP_STAGING_INVALID',
  'BACKUP_BUSY',
  'KEY_LOCKED',
  'KEY_INVALIDATED',
]);

function exportFailure(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
  return typeof code === 'string' && SPECIFIC_EXPORT_ERRORS.has(code)
    ? describeBackupError(error)
    : copy['create.failed'];
}

type Stage =
  | { name: 'form' }
  | { name: 'busy'; done: number; total: number }
  | { name: 'error'; message: string };

export type CreateBackupSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The backup reached the share sheet or was saved, and the vault stayed unlocked. */
  onShared: (date: Date) => void;
};

function Rule({ met, label }: { met: boolean; label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${met ? 'met' : 'not met'}`}
      style={styles.rule}
    >
      <Icon name={met ? 'check' : 'info'} size={16} tone={met ? 'success' : 'tertiary'} />
      <Text variant="footnote" tone={met ? 'primary' : 'secondary'} style={styles.ruleText}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The create backup sheet (handover §6 J6, §7.7): passphrase with an
 * on-device strength estimate that never blocks, the two rules that are
 * enforced, a busy step that cannot be dismissed, then the system share
 * sheet, or on Android the system save screen. The container is removed once
 * sharing or saving ends. A backup finished after
 * the vault locked, or after the hub went away, is deleted unshared: the
 * share sheet is system UI and would open over the lock screen.
 */
export function CreateBackupSheet({ visible, onClose, onShared }: CreateBackupSheetProps) {
  const toast = useToast();
  const { withoutAutoLock, captureSession, postNotice } = useSession();
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [stage, setStage] = useState<Stage>({ name: 'form' });
  const [open, setOpen] = useState(visible);
  // The lock unmounts the hub while an export may still be running.
  const mounted = useRef(true);
  // Try again after a failed export goes where the first attempt was going.
  const lastDestination = useRef<Destination>('share');
  const preferred: Destination = CAN_SAVE() ? 'save' : 'share';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Each opening starts with empty fields. `open` follows `visible` until the
  // export hands off, when the sheet closes itself before the share sheet.
  if (visible !== open) {
    setOpen(visible);
    if (visible) {
      setPassphrase('');
      setConfirmation('');
      setStage({ name: 'form' });
    }
  }

  const characters = Array.from(passphrase);
  const longEnough = characters.length >= MIN_PASSPHRASE_LENGTH;
  const varied = characters.length > 0 && new Set(characters).size > 1;
  const matches = confirmation.length > 0 && confirmation === passphrase;
  const valid = passphraseProblem(passphrase, confirmation) === null;
  const busy = stage.name === 'busy';

  const create = useCallback(
    async (destination: Destination) => {
      if (passphraseProblem(passphrase, confirmation) !== null) return;
      lastDestination.current = destination;
      const session = captureSession();
      const stillHere = () => mounted.current && session.current();
      setStage({ name: 'busy', done: 0, total: 1 });
      let cancelled = false;
      try {
        // The service removes the container once this returns or throws.
        await backupService.exportBackup(
          passphrase,
          async (backup) => {
            if (!stillHere()) {
              cancelled = true;
              return;
            }
            setPassphrase('');
            setConfirmation('');
            setStage({ name: 'form' });
            onClose();
            // Let the sheet's modal finish dismissing; presenting the share sheet
            // over a dismissing modal leaves iOS with neither on screen.
            await new Promise((resolve) => setTimeout(resolve, 450));
            if (!mounted.current || !(await session.confirm()) || !mounted.current) {
              cancelled = true;
              return;
            }
            if (destination === 'save') {
              // The same encrypted container the share sheet hands out; the
              // service removes the staged copy once this returns or throws.
              let outcome: Awaited<ReturnType<typeof saveBackupToDevice>>;
              try {
                outcome = await saveBackupToDevice(backup.uri, backup.name, {
                  aroundPicker: (work) => withoutAutoLock(work),
                  stillCurrent: session.current,
                  ended: session.ended(),
                });
              } catch {
                // The provider's own text can name paths or accounts: one sentence instead.
                if (session.current()) {
                  toast.show({ message: copy['create.saveFailed'], tone: 'danger' });
                } else {
                  postNotice({ message: SAVE_INTERRUPTED });
                }
                return;
              }
              if (outcome === 'interrupted' || !session.current()) {
                postNotice({ message: SAVE_INTERRUPTED });
                return;
              }
              if (outcome === 'cancelled') {
                toast.show({ message: copy['create.saveCancelled'] });
                return;
              }
              const saved = new Date();
              await recordLastBackup(saved);
              if (mounted.current) onShared(saved);
              toast.show({
                message: t('backup.create.saved', {
                  count: backup.entries,
                  size: formatFileSize(backup.bytes),
                }),
                tone: 'success',
              });
              return;
            }
            // A share that never settles must not keep the export, and its slot, open.
            await Promise.race([
              withoutAutoLock(
                () =>
                  Sharing.shareAsync(backup.uri, {
                    dialogTitle: backup.name,
                    mimeType: 'application/octet-stream',
                    UTI: 'public.data',
                  }),
                sharePause(),
              ),
              session.ended(),
            ]);
            if (!session.current()) {
              // It may have been shared already, so this says less than EXPORT_STOPPED.
              postNotice({ message: SHARE_INTERRUPTED });
              return;
            }
            const made = new Date();
            await recordLastBackup(made);
            if (mounted.current) onShared(made);
            toast.show({
              message: t('backup.create.shared', {
                count: backup.entries,
                size: formatFileSize(backup.bytes),
              }),
              tone: 'success',
            });
          },
          (event) => {
            if (mounted.current) setStage({ name: 'busy', done: event.done, total: event.total });
          },
        );
      } catch (error) {
        if (stillHere()) setStage({ name: 'error', message: exportFailure(error) });
        else cancelled = true;
      } finally {
        if (cancelled) postNotice({ message: EXPORT_STOPPED });
      }
    },
    [
      passphrase,
      confirmation,
      captureSession,
      withoutAutoLock,
      postNotice,
      toast,
      onClose,
      onShared,
    ],
  );

  const percent =
    stage.name === 'busy' && stage.total > 0 ? Math.round((stage.done / stage.total) * 100) : 0;

  return (
    <Sheet
      visible={open}
      onClose={onClose}
      title={busy ? copy['create.busy.title'] : copy['create.title']}
      headerAction={
        stage.name === 'form' ? { label: copy['restore.cancel'], onPress: onClose } : undefined
      }
      dismissable={!busy}
      // One way out, as on the Backup board: Cancel on the form, Close in
      // the error state; the busy state cannot be closed at all.
      closeButton={false}
    >
      {stage.name === 'busy' ? (
        <View style={styles.body}>
          <ProgressBlock
            label={t('backup.create.progress', { done: stage.done, total: stage.total })}
            detail={t('backup.create.percent', { percent })}
            progress={stage.total ? stage.done / stage.total : 0}
          />
          <Text variant="subheadline" tone="secondary">
            {copy['create.busy.body']}
          </Text>
        </View>
      ) : stage.name === 'error' ? (
        <View style={styles.body}>
          <InlineAlert tone="danger" message={stage.message} />
          <Button
            label={copy['create.retry']}
            onPress={() => void create(lastDestination.current)}
          />
          <Button label={copy['create.close']} variant="plain" onPress={onClose} />
        </View>
      ) : (
        <View style={styles.body}>
          <Text variant="subheadline" tone="secondary">
            {copy['create.intro']}
          </Text>
          <PassphraseField
            label={copy['create.passphrase']}
            value={passphrase}
            onChangeText={setPassphrase}
          />
          <StrengthMeter passphrase={passphrase} />
          <Text variant="footnote" tone="secondary">
            {copy['create.hint']}
          </Text>
          <PassphraseField
            label={copy['create.repeat']}
            value={confirmation}
            onChangeText={setConfirmation}
            returnKeyType="go"
            onSubmitEditing={() => void create(preferred)}
          />
          {matches ? (
            <View accessible accessibilityLabel={copy['create.match']} style={styles.rule}>
              <Icon name="check" size={16} tone="success" />
              <Text variant="footnote" tone="success" style={styles.ruleText}>
                {copy['create.match']}
              </Text>
            </View>
          ) : confirmation.length > 0 && longEnough && varied ? (
            <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
              {copy['create.mismatch']}
            </Text>
          ) : null}
          <View style={styles.rules}>
            <Rule met={longEnough} label={copy['create.rule.length']} />
            <Rule met={varied} label={copy['create.rule.repeated']} />
          </View>
          <InlineAlert tone="info" message={copy['create.sameEverywhere']} />
          {CAN_SAVE() ? (
            <>
              <Button
                label={copy['create.save']}
                onPress={() => void create('save')}
                disabled={!valid}
              />
              <Button
                label={copy['create.share']}
                variant="tinted"
                onPress={() => void create('share')}
                disabled={!valid}
              />
            </>
          ) : (
            <Button
              label={copy['create.button']}
              onPress={() => void create('share')}
              disabled={!valid}
            />
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  rules: {
    gap: theme.spacing.xxs,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 22,
  },
  // Rules wrap at the largest text sizes instead of running off the sheet.
  ruleText: {
    flexShrink: 1,
  },
}));
