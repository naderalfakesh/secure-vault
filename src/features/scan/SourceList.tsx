import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, type IconName, InlineAlert, ListRow, Text } from '@/components/ui';

import { type ScanCopyKey, scanText, unsupportedFileMessage } from './scanCopy';

export type Source = 'scan' | 'camera' | 'library' | 'files';

/** What went wrong with the last pick, shown inline above the rows. */
export type SourceProblem =
  { kind: 'unsupported'; name: string } | { kind: 'failed'; message: string };

export type SourceListProps = {
  scannerSupported: boolean;
  cameraAvailable: boolean;
  /** Camera access refused: the camera rows give way to the callout. */
  cameraDenied: boolean;
  problem: SourceProblem | null;
  onPick: (source: Source) => void;
  onOpenSettings: () => void;
};

type Row = {
  key: Source;
  icon: IconName;
  title: ScanCopyKey;
  subtitle: ScanCopyKey;
  disabled?: boolean;
};

/**
 * The camera rows depend on the hardware (F9): the platform scanner and a
 * plain photo when there is a camera; both disabled with the reason when there
 * is none, because the native camera picker aborts on a camera-less device.
 * Without the scanner but with a camera, only the photo row is offered.
 */
export function sourceRows(
  scannerSupported: boolean,
  cameraAvailable: boolean,
  cameraDenied: boolean,
): Row[] {
  const rows: Row[] = [];
  if (!cameraDenied) {
    if (!cameraAvailable) {
      rows.push(
        {
          key: 'scan',
          icon: 'scan',
          title: 'sources.scan.title',
          subtitle: 'sources.noCamera',
          disabled: true,
        },
        {
          key: 'camera',
          icon: 'camera',
          title: 'sources.camera.title',
          subtitle: 'sources.noCamera',
          disabled: true,
        },
      );
    } else {
      if (scannerSupported) {
        rows.push({
          key: 'scan',
          icon: 'scan',
          title: 'sources.scan.title',
          subtitle: 'sources.scan.subtitle',
        });
      }
      rows.push({
        key: 'camera',
        icon: 'camera',
        title: 'sources.camera.title',
        subtitle: 'sources.camera.subtitle',
      });
    }
  }
  rows.push(
    {
      key: 'library',
      icon: 'photos',
      title: 'sources.library.title',
      subtitle: 'sources.library.subtitle',
    },
    {
      key: 'files',
      icon: 'files',
      title: 'sources.files.title',
      subtitle: 'sources.files.subtitle',
    },
  );
  return rows;
}

export function SourceList({
  scannerSupported,
  cameraAvailable,
  cameraDenied,
  problem,
  onPick,
  onOpenSettings,
}: SourceListProps) {
  const rows = sourceRows(scannerSupported, cameraAvailable, cameraDenied);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {cameraDenied ? (
        <View style={styles.denied}>
          <InlineAlert tone="warning" icon="camera" message={scanText('sources.cameraDenied')} />
          <View style={styles.deniedAction}>
            <Button
              label={scanText('sources.openSettings')}
              variant="tinted"
              size="md"
              onPress={onOpenSettings}
            />
          </View>
        </View>
      ) : null}
      {problem ? (
        <InlineAlert
          tone="danger"
          message={
            problem.kind === 'unsupported' ? unsupportedFileMessage(problem.name) : problem.message
          }
        />
      ) : null}
      {rows.map((row) => {
        const retry = row.key === 'files' && problem?.kind === 'unsupported';
        return (
          <View
            key={row.key}
            style={[styles.row, row.key === 'scan' && !row.disabled && styles.hero]}
          >
            <ListRow
              icon={row.icon}
              tint={row.disabled ? 'neutral' : 'primary'}
              title={scanText(retry ? 'sources.files.retry' : row.title)}
              subtitle={scanText(row.subtitle)}
              disabled={row.disabled}
              onPress={() => onPick(row.key)}
              trailing={null}
              divider={false}
            />
          </View>
        );
      })}
      <View style={styles.footer}>
        <Icon name="lock" size={14} tone="secondary" />
        <Text variant="footnote" tone="secondary" style={styles.footerText}>
          {scanText('sources.footer')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  row: {
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  hero: {
    backgroundColor: theme.colors.primaryMuted,
  },
  denied: {
    gap: theme.spacing.xs,
    padding: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.accentMuted,
  },
  deniedAction: {
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
  },
  footerText: {
    flex: 1,
  },
}));
