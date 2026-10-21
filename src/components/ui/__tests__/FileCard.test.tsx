import { render } from '@testing-library/react-native';

import { FileCard } from '../FileCard';

describe('FileCard', () => {
  it('reads the file name and meta as one element and isolates the name', async () => {
    const view = await render(
      <FileCard name="عقد الإيجار 2026.svbackup" meta="48 entries · made 3 Oct 2026" />,
    );

    expect(
      view.getByLabelText('⁨عقد الإيجار 2026.svbackup⁩, 48 entries · made 3 Oct 2026'),
    ).toBeOnTheScreen();
    expect(view.getByText('⁨عقد الإيجار 2026.svbackup⁩')).toBeOnTheScreen();
  });
});
