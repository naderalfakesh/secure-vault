type NativeStub = {
  isSupported?: () => boolean;
  isCameraAvailable?: () => boolean;
} | null;

/** Loads the real module against a stubbed native binding and device flag. */
function loadWith(native: NativeStub, isDevice = true): typeof import('./index') {
  let api: typeof import('./index') | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo', () => ({ requireOptionalNativeModule: () => native }));
    jest.doMock('expo-device', () => ({ isDevice }));
    api = jest.requireActual('./index');
  });
  if (!api) throw new Error('module did not load');
  return api;
}

describe('isCameraAvailable', () => {
  it('reports the native probe when the build has it', () => {
    expect(loadWith({ isCameraAvailable: () => true }).isCameraAvailable()).toBe(true);
    expect(loadWith({ isCameraAvailable: () => false }).isCameraAvailable()).toBe(false);
  });

  it('falls back to the device flag when the native build predates the probe', () => {
    expect(loadWith({ isSupported: () => false }, true).isCameraAvailable()).toBe(true);
    expect(loadWith({ isSupported: () => false }, false).isCameraAvailable()).toBe(false);
  });

  it('is false when the probe throws or the module is missing', () => {
    expect(
      loadWith({
        isCameraAvailable: () => {
          throw new Error('native failure');
        },
      }).isCameraAvailable(),
    ).toBe(false);
    expect(loadWith(null, true).isCameraAvailable()).toBe(false);
  });
});

describe('isScannerSupported', () => {
  it('still mirrors the native answer', () => {
    expect(loadWith({ isSupported: () => true }).isScannerSupported()).toBe(true);
    expect(loadWith({ isSupported: () => false }).isScannerSupported()).toBe(false);
    expect(loadWith(null).isScannerSupported()).toBe(false);
  });
});
