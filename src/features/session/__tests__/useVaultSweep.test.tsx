import { renderHook } from '@testing-library/react-native';

import vault from '../../../../modules/expo-vault';
import type { SessionStatus } from '@/features/session/SessionProvider';
import { useVaultSweep } from '@/features/session/useVaultSweep';
import * as clipboard from '@/features/viewer/clipboard';
import { backupService } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';

function spies() {
  return {
    clearCache: jest.spyOn(documentService, 'clearCache').mockResolvedValue(undefined),
    sweepCache: jest.spyOn(backupService, 'sweepCache').mockImplementation(() => {}),
    dismiss: jest.spyOn(vault, 'dismissShareSheet').mockResolvedValue(false),
    clipboard: jest.spyOn(clipboard, 'clearCopiedText').mockResolvedValue(false),
  };
}

function renderSweep(initial: SessionStatus) {
  return renderHook(({ status }: { status: SessionStatus }) => useVaultSweep(status), {
    initialProps: { status: initial },
  });
}

describe('useVaultSweep', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each<SessionStatus>(['setup', 'unavailable'])(
    'sweeps the caches at launch when the session lands on %s',
    async (landing) => {
      const s = spies();
      const hook = await renderSweep('loading');
      expect(s.clearCache).not.toHaveBeenCalled();

      await hook.rerender({ status: landing });
      expect(s.clearCache).toHaveBeenCalledTimes(1);
      expect(s.sweepCache).toHaveBeenCalledTimes(1);
      // Nothing was unlocked yet, so there is no share sheet or copied text.
      expect(s.dismiss).not.toHaveBeenCalled();
      expect(s.clipboard).not.toHaveBeenCalled();
    },
  );

  it('sweeps once at launch, not on every later setup or unavailable state', async () => {
    const s = spies();
    const hook = await renderSweep('loading');
    await hook.rerender({ status: 'unavailable' });
    await hook.rerender({ status: 'setup' });
    await hook.rerender({ status: 'unlocked' });
    await hook.rerender({ status: 'setup' });

    expect(s.clearCache).toHaveBeenCalledTimes(1);
    expect(s.sweepCache).toHaveBeenCalledTimes(1);
  });

  it('sweeps everything on every lock, the launch lock included', async () => {
    const s = spies();
    const hook = await renderSweep('loading');
    await hook.rerender({ status: 'locked' });
    await hook.rerender({ status: 'unlocked' });
    await hook.rerender({ status: 'locked' });

    expect(s.clearCache).toHaveBeenCalledTimes(2);
    expect(s.sweepCache).toHaveBeenCalledTimes(2);
    expect(s.dismiss).toHaveBeenCalledTimes(2);
    expect(s.clipboard).toHaveBeenCalledTimes(2);
  });

  it('does not sweep while unlocked', async () => {
    const s = spies();
    const hook = await renderSweep('loading');
    await hook.rerender({ status: 'locked' });
    s.clearCache.mockClear();
    await hook.rerender({ status: 'unlocked' });

    expect(s.clearCache).not.toHaveBeenCalled();
  });
});
