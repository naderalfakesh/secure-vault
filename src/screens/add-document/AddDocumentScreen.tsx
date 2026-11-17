import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import { Button, IconButton, Screen } from '@/components/ui';
import { DetailsForm } from '@/features/scan/DetailsForm';
import { ProcessingPanel } from '@/features/scan/ProcessingPanel';
import { ReviewPages } from '@/features/scan/ReviewPages';
import { pageCount, scanText } from '@/features/scan/scanCopy';
import { SourceList } from '@/features/scan/SourceList';

import { FlowHeader } from './components';
import { useAddDocumentFlow } from './hooks/useAddDocumentFlow';

const close = () => router.back();
const openSettings = () => void Linking.openSettings().catch(() => {});

/**
 * Scan and import.
 *
 * Picker, photo and scanner copies are plaintext. This screen owns them from
 * the moment a source hands them over: a removed page loses its copy at once,
 * and every way out without saving (Discard, Cancel, Back to the sources, a
 * late result after the screen closed, the screen closing, the lock gate
 * taking the screen away) removes them. A save in flight owns them instead:
 * the vault module still has to read them, and the service removes them when
 * it has. The lock and launch sweeps catch anything a kill leaves.
 */
export function AddDocumentScreen() {
  const flow = useAddDocumentFlow();
  const { phase, files, thumbnails, details } = flow;

  let header: ReactNode;
  let body: ReactNode;
  switch (phase) {
    case 'review':
      header = (
        <FlowHeader
          leading={
            <Button
              label={scanText('review.discard')}
              variant="plain"
              size="md"
              onPress={flow.discardAll}
            />
          }
          title={pageCount(files.length)}
          trailing={
            <Button
              label={scanText('review.continue')}
              variant="plain"
              size="md"
              onPress={flow.continueToRead}
            />
          }
        />
      );
      body = (
        <ReviewPages
          pages={files}
          onRemove={flow.removePage}
          onMove={flow.reorder}
          onAddPages={flow.scannerSupported ? flow.addPages : undefined}
        />
      );
      break;
    case 'reading':
    case 'saving':
      header = <FlowHeader />;
      body = (
        <ProcessingPanel
          step={flow.step}
          thumbnails={thumbnails}
          onCancel={flow.backFromDetails}
          error={phase === 'saving' ? flow.saveError : null}
          onRetry={flow.save}
          onBack={flow.savedId ? undefined : flow.backToDetails}
          onOpen={flow.savedId ? flow.openSaved : undefined}
        />
      );
      break;
    case 'details':
      header = (
        <FlowHeader
          leading={
            <Button
              label={scanText('details.back')}
              accessibilityLabel={scanText(
                flow.origin === 'scan' ? 'details.backToPages' : 'details.backToSources',
              )}
              variant="plain"
              size="md"
              icon="back"
              onPress={flow.backFromDetails}
            />
          }
          title={scanText('details.title')}
        />
      );
      body = (
        <DetailsForm
          thumbnails={thumbnails}
          fallbackName={files[0]?.name ?? ''}
          title={details.title}
          onTitle={flow.setTitle}
          titleMissing={details.titleMissing}
          category={details.category}
          categorySuggested={details.categorySuggested}
          onCategory={flow.setCategory}
          fields={details.fields}
          onRemoveField={flow.removeField}
          tags={details.tags}
          onTags={flow.setTags}
          onSave={flow.save}
        />
      );
      break;
    default:
      header = (
        <FlowHeader
          title={scanText('sources.title')}
          trailing={
            <IconButton icon="close" accessibilityLabel={scanText('close')} onPress={close} />
          }
        />
      );
      body = (
        <SourceList
          scannerSupported={flow.scannerSupported}
          cameraAvailable={flow.cameraAvailable}
          cameraDenied={flow.cameraDenied}
          problem={flow.problem}
          onPick={flow.pick}
          onOpenSettings={openSettings}
        />
      );
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      {header}
      {body}
    </Screen>
  );
}
