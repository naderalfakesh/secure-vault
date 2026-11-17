import { ScrollView, View } from 'react-native';

import { Button, Icon, InlineAlert, ListRow, Text } from '@/components/ui';

import { protectedFileMessage, scanText, unsupportedFileMessage } from '../scanCopy';
import { styles } from './SourceList.styles';
import { sourceRows } from './sourceRows';
import type { Source, SourceProblem } from './types';

export type SourceListProps = {
  scannerSupported: boolean;
  cameraAvailable: boolean;
  /** Camera access refused: the camera rows give way to the callout. */
  cameraDenied: boolean;
  problem: SourceProblem | null;
  onPick: (source: Source) => void;
  onOpenSettings: () => void;
};

/** Where a document comes from, with what went wrong last time above the rows. */
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
            problem.kind === 'unsupported'
              ? unsupportedFileMessage(problem.name)
              : problem.kind === 'protected'
                ? protectedFileMessage(problem.name)
                : problem.message
          }
        />
      ) : null}
      {rows.map((row) => {
        const retry =
          row.key === 'files' && (problem?.kind === 'unsupported' || problem?.kind === 'protected');
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
