import { vaultMock } from '@/testing/vault';
import { type BackupProgress } from '@modules/expo-vault';

/** A progress event as the native restore sends it, for a stubbed import. */
export const emitProgress = (event: BackupProgress) => vaultMock.emitProgress(event);

export const picked = {
  uri: '/tmp/passport.jpg',
  name: 'passport.jpg',
  type: 'image/jpeg',
  size: 2048,
};
