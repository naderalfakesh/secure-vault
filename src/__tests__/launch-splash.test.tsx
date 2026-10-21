import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import vault from '../../modules/expo-vault';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => {}),
}));

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };
const hide = SplashScreen.hideAsync as jest.Mock;

const stub = (label: string) =>
  function Stub() {
    return <Text>{label}</Text>;
  };

const routes = {
  appDir: 'app',
  overrides: {
    '(tabs)/index': stub('Library'),
    '(tabs)/settings': stub('Settings'),
    'setup/index': stub('Welcome'),
    'setup/pin': stub('Choose a PIN'),
  },
};

describe('launch splash', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    hide.mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('stays up until the stored appearance has been applied', async () => {
    let finishRead!: (value: string | null) => void;
    const read = SecureStore.getItemAsync;
    jest.spyOn(SecureStore, 'getItemAsync').mockImplementation((key, options) =>
      key === 'securevault.appearance'
        ? new Promise((resolve) => {
            finishRead = resolve;
          })
        : read(key, options),
    );

    await renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Welcome');
    expect(hide).not.toHaveBeenCalled();

    await act(async () => finishRead('dark'));
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('hides once both reads are in when the appearance read fails', async () => {
    const read = SecureStore.getItemAsync;
    jest
      .spyOn(SecureStore, 'getItemAsync')
      .mockImplementation((key, options) =>
        key === 'securevault.appearance'
          ? Promise.reject(new Error('refused'))
          : read(key, options),
      );

    await renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Welcome');

    expect(hide).toHaveBeenCalledTimes(1);
  });
});
