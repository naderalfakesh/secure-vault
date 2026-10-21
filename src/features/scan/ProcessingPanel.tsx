import { ActivityIndicator, ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Icon, InlineAlert, Text } from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { DocumentImage } from '@/features/documents/DocumentImage';
import { t } from '@/i18n';

import { type ScanCopyKey, scanText } from './scanCopy';

export type ProcessingStep = 'ocr' | 'suggest' | 'encrypt' | 'index';

const STEPS: ProcessingStep[] = ['ocr', 'suggest', 'encrypt', 'index'];
const STEP_COPY: Record<ProcessingStep, ScanCopyKey> = {
  ocr: 'step.ocr',
  suggest: 'step.suggest',
  encrypt: 'step.encrypt',
  index: 'step.index',
};

/** Steps before this one can still be cancelled (handover §6 J1, F12). */
export function isCancellable(step: ProcessingStep): boolean {
  return STEPS.indexOf(step) < STEPS.indexOf('encrypt');
}

export type ProcessingPanelProps = {
  step: ProcessingStep;
  /** Page images to show above the steps (at most three are drawn). */
  thumbnails: readonly string[];
  /** Shown while reading; there is no cancel once encrypting starts. */
  onCancel: () => void;
  /** A failed save: shown inline with Try again, the pages kept. */
  error?: string | null;
  onRetry?: () => void;
  onBack?: () => void;
  /** The document is saved; leave for it without the values that failed. */
  onOpen?: () => void;
};

/**
 * Reading the text → Suggesting details → Encrypting → Saving to your vault.
 * Each step is announced politely; Cancel disappears when encrypting starts
 * and "This can't be stopped." is announced in its place.
 */
export function ProcessingPanel({
  step,
  thumbnails,
  onCancel,
  error,
  onRetry,
  onBack,
  onOpen,
}: ProcessingPanelProps) {
  const { theme } = useUnistyles();
  const cancellable = isCancellable(step);
  const failed = Boolean(error);
  const current = STEPS.indexOf(step);
  // The step is announced as it starts; while Cancel shows, the announcement
  // says so, and once encrypting starts the callout below takes over.
  useAnnouncement(
    failed
      ? null
      : cancellable
        ? t('scan.processing.stepCancellable', { step: scanText(STEP_COPY[step]) })
        : scanText(STEP_COPY[step]),
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="title3" accessibilityRole="header">
        {scanText(cancellable ? 'processing.reading' : 'processing.saving')}
      </Text>
      {thumbnails.length > 0 ? (
        <View
          style={styles.thumbs}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {thumbnails.slice(0, 3).map((uri) => (
            <DocumentImage key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" />
          ))}
        </View>
      ) : null}
      <View style={styles.steps} accessibilityLiveRegion="polite">
        {STEPS.map((item, index) => {
          const done = index < current;
          const active = index === current && !failed;
          const state = scanText(
            done ? 'step.state.done' : active ? 'step.state.active' : 'step.state.waiting',
          );
          return (
            <View
              key={item}
              accessible
              accessibilityLabel={t('scan.step.label', { step: scanText(STEP_COPY[item]), state })}
              style={styles.step}
            >
              {active ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Icon
                  name={done ? 'checkCircle' : 'clock'}
                  size={20}
                  tone={done ? 'success' : 'tertiary'}
                />
              )}
              <Text
                variant="body"
                tone={done || active ? 'primary' : 'tertiary'}
                style={styles.flex}
              >
                {scanText(STEP_COPY[item])}
              </Text>
              {done || active ? (
                <Text variant="footnote" tone="secondary">
                  {scanText(done ? 'processing.done' : 'processing.working')}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      {failed ? (
        <View style={styles.actions}>
          <InlineAlert tone="danger" message={error ?? scanText('processing.failed')} />
          {onRetry ? (
            <Button label={scanText('processing.retry')} icon="refresh" onPress={onRetry} />
          ) : null}
          {onOpen ? (
            <Button
              label={scanText('processing.openDocument')}
              variant="secondary"
              onPress={onOpen}
            />
          ) : null}
          {onBack ? (
            <Button
              label={scanText('processing.backToDetails')}
              variant="secondary"
              onPress={onBack}
            />
          ) : null}
        </View>
      ) : cancellable ? null : (
        <InlineAlert
          tone="warning"
          title={scanText('processing.unstoppable')}
          message={scanText('processing.unstoppableDetail')}
          announce
        />
      )}
      <Text variant="footnote" tone="secondary">
        {scanText('processing.footer')}
      </Text>
      {cancellable && !failed ? (
        <Button label={scanText('processing.cancel')} variant="secondary" onPress={onCancel} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  flex: {
    flex: 1,
  },
  thumbs: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.paper,
  },
  steps: {
    gap: theme.spacing.sm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: theme.touchTarget,
  },
  actions: {
    gap: theme.spacing.sm,
  },
}));
