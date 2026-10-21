/** J5 Share (handover §6 J5, §7.4). */
export const share = {
  'share.warning.title': 'Share a decrypted copy?',
  'share.warning.body':
    'Whoever gets this file can open it without your PIN. SecureVault removes its temporary copy when sharing ends, but it can’t control copies the other app keeps.',
  'share.warning.share': 'Share',
  'share.warning.cancel': 'Cancel',
  'share.warning.notConfirmed': 'Not confirmed, so nothing was shared.',
  'share.preparing.title': 'Preparing a copy',
  // The copy is the document's one stored file, decrypted in a single native
  // call, so there is no page-by-page count to show (verification note).
  'share.preparing.label': 'Decrypting the document',
  'share.preparing.cancel': 'Cancel',
  /** Spoken when the preparing step appears, so the Cancel control is announced with it. */
  'share.preparing.announce': 'Preparing a copy. Cancel is available.',
  'share.failed': 'Couldn’t prepare the file.',
  'share.interrupted.lead': 'SecureVault locked while you were sharing.',
  'share.interrupted.body': 'The temporary copy was removed. Share again if you still need to.',
  'share.interrupted.again': 'Share again',
  'share.confirmPasscode': 'Confirm with passcode',
  'share.confirmScreenLock': 'Confirm with screen lock',
  /** `{biometry}` is "Face ID", "Touch ID" or "biometric unlock". */
  'share.confirmBiometry': 'Confirm with {biometry}',
} as const;
