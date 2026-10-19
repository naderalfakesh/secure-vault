import { render } from '@testing-library/react-native';

import { DocumentImage } from '../DocumentImage';

describe('DocumentImage', () => {
  it('keeps decrypted images out of the image disk cache', async () => {
    const view = await render(
      <DocumentImage testID="page" source={{ uri: 'file:///cache/decrypted_1.jpg' }} />,
    );

    expect(view.getByTestId('page').props.cachePolicy).toBe('memory');
  });
});
