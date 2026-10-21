import { render } from '@testing-library/react-native';
import { I18nManager, Platform } from 'react-native';

import { Icon, icons } from '../Icon';

// The icon fonts load through the asset registry, which Jest does not have.
jest.mock('@expo/vector-icons', () => {
  const { Text } = jest.requireActual('react-native');
  const Glyph = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Glyph, MaterialCommunityIcons: Glyph };
});

describe('Icon', () => {
  it('covers the handover icon set', () => {
    const set = [
      'lock',
      'faceId',
      'search',
      'scan',
      'plus',
      'document',
      'library',
      'settings',
      'share',
      'trash',
      'chevronLeft',
      'chevronRight',
      'shield',
      'archive',
      'key',
      'check',
      'checkCircle',
      'warning',
      'info',
      'close',
      'backspace',
      'sort',
      'filter',
      'calendar',
      'more',
      'idCard',
      'medical',
      'finance',
      'legal',
      'receipt',
      'folder',
      'camera',
      'eye',
      'eyeOff',
      'clock',
      'refresh',
      'pages',
      'tag',
      'edit',
      'export',
      'restore',
      'image',
    ];
    expect(set.filter((name) => !(name in icons))).toEqual([]);
  });

  it('hides decorative icons and names labelled ones', async () => {
    const view = await render(
      <>
        <Icon name="lock" />
        <Icon name="info" accessibilityLabel="About" />
      </>,
    );
    expect(view.getByLabelText('About')).toBeOnTheScreen();
  });

  describe('on Android', () => {
    const os = Platform.OS;
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    });
    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
      Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: false });
    });

    it('mirrors directional glyphs in right-to-left layouts only', async () => {
      Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: true });
      const view = await render(
        <>
          <Icon name="chevronRight" accessibilityLabel="Next" />
          <Icon name="backspace" accessibilityLabel="Delete" />
        </>,
      );
      expect(view.getByLabelText('Next')).toHaveStyle({ transform: [{ scaleX: -1 }] });
      expect(view.getByText('chevron-right')).toBeOnTheScreen();
      expect(view.getByLabelText('Delete')).not.toHaveStyle({ transform: [{ scaleX: -1 }] });
    });
  });
});
