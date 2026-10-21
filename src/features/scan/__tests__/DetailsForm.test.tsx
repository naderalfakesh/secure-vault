import { render } from '@testing-library/react-native';

import { DocumentCategory } from '@/types';
import { isolate } from '@/utils/bidi';

import { DetailsForm } from '../DetailsForm';
import { scanCopy } from '../scanCopy';

const noop = () => {};

describe('DetailsForm', () => {
  it('isolates the file name it shows when there is no page image', async () => {
    const name = 'عقد الإيجار 2026.pdf';
    const view = await render(
      <DetailsForm
        thumbnails={[]}
        fallbackName={name}
        title=""
        onTitle={noop}
        titleMissing={false}
        category={DocumentCategory.OTHER}
        categorySuggested={false}
        onCategory={noop}
        fields={[]}
        onRemoveField={noop}
        tags=""
        onTags={noop}
        onSave={noop}
      />,
    );

    expect(view.getByText(isolate(name), { includeHiddenElements: true })).toBeTruthy();
  });

  it('keeps the flow strings in the table', () => {
    expect(scanCopy['scan.defaultTitle']).toBe('Scanned document');
    expect(scanCopy['details.backToPages']).toBe('Back to pages');
    expect(scanCopy['details.backToSources']).toBe('Back to sources');
  });
});
