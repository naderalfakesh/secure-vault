/** Vault unavailable (handover §7.2). */
export const unavailable = {
  'unavailable.title': 'SecureVault can’t open right now',
  'unavailable.body':
    'Your phone didn’t give SecureVault access to its key. Nothing in the vault was touched.',
  'unavailable.hint':
    'Try again. If this keeps happening, restart your phone and open SecureVault again.',
  'unavailable.tryAgain': 'Try again',
  'unavailable.trying': 'Trying again…',
  'unavailable.pinLost.body':
    'SecureVault can’t read your PIN. Your documents are still there, encrypted with your phone’s key.',
  'unavailable.pinLost.hint':
    'Unlock with Face ID, your fingerprint or your phone’s passcode to set a new PIN.',
  'unavailable.pinLost.reset': 'Set a new PIN',
  'unavailable.pinLost.resetting': 'Unlocking…',
  'unavailable.keyInvalidated.hint':
    'Delete everything to set up SecureVault again. A backup you saved elsewhere can be restored afterwards.',
  'unavailable.keyInvalidated.failed': 'The vault could not be cleared. Try again.',
} as const;
