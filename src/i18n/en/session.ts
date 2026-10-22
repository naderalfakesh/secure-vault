/** Unlock, setup and PIN-change failures reported by the session. */
export const session = {
  'session.biometricFailed': 'That did not match. Try again or enter your PIN.',
  'session.biometricUnavailable': 'Biometrics are not available right now. Enter your PIN.',
  'session.noAuthEnrolled': 'Set up a screen lock in your device settings first.',
  'session.keyRetrievalFailed': 'The vault key could not be read. Restart the app and try again.',
  'session.pinUnreadable': 'Your PIN could not be read right now. Try again.',
  'session.keyNotUnlocked.unlock': 'The device key was not unlocked. Enter your PIN to try again.',
  'session.keyNotUnlocked.setup': 'The device key was not unlocked. Try again.',
  'session.keyNotUnlocked.resetPin':
    'The device key was not unlocked, so no new PIN was set. Try again.',
  'session.keyNotUnlocked.changePin':
    'The device key was not unlocked, so the PIN was not changed. Try again.',
  'session.unlockKeyFailed': 'Could not unlock the vault key.',
  'session.unlockFailed': 'Could not unlock the vault.',
  'session.checkPinFailed': 'Could not check the PIN.',
  'session.setUpFailed': 'Could not set up the vault.',
  'session.changePinFailed': 'Could not change the PIN.',
} as const;
