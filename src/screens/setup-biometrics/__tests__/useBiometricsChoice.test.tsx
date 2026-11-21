import { act, renderHook } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import { useBiometricsChoice } from '../hooks/useBiometricsChoice';

const mockFinishSetup = jest.fn();
const mockUpdateSettings = jest.fn();

jest.mock('@/features/session/SessionProvider', () => ({
  useSessionActions: () => ({ finishSetup: mockFinishSetup, updateSettings: mockUpdateSettings }),
}));

jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(),
}));

describe('useBiometricsChoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: true });
  });

  it('saves the choice and finishes setup', async () => {
    mockUpdateSettings.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useBiometricsChoice());

    await act(async () => {
      await result.current.enableBiometrics();
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ biometricUnlock: true });
    expect(mockFinishSetup).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);
  });

  it.each(['enableBiometrics', 'notNow'] as const)(
    'frees the buttons when saving fails on %s',
    async (action) => {
      mockUpdateSettings.mockRejectedValue(new Error('write refused'));
      const { result } = await renderHook(() => useBiometricsChoice());

      await act(async () => {
        await result.current[action]();
      });

      expect(mockFinishSetup).not.toHaveBeenCalled();
      expect(result.current.busy).toBe(false);
    },
  );
});
