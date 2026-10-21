import { fireEvent, render } from '@testing-library/react-native';

import { CollectionGrid, CollectionTile } from '../CollectionTile';

describe('CollectionTile', () => {
  it('names the collection and its count', async () => {
    const onPress = jest.fn();
    const view = await render(
      <CollectionTile name="ID & Personal" count={6} icon="idCard" onPress={onPress} />,
    );

    await fireEvent.press(view.getByRole('button', { name: '⁨ID & Personal⁩, 6 documents' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the singular for one document', async () => {
    const view = await render(
      <CollectionTile name="Legal" count={1} icon="legal" onPress={jest.fn()} />,
    );

    expect(view.getByRole('button', { name: '⁨Legal⁩, 1 document' })).toBeOnTheScreen();
  });

  it('lays tiles out two to a row', async () => {
    const view = await render(
      <CollectionGrid>
        <CollectionTile name="Medical" count={2} icon="medical" />
        <CollectionTile name="Finance" count={3} icon="finance" />
        <CollectionTile name="Legal" count={9} icon="legal" />
      </CollectionGrid>,
    );

    expect(view.getAllByRole('button')).toHaveLength(3);
  });
});
