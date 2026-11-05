/** Lock screen and lockout. */
export const lock = {
  'lock.title': 'SecureVault is locked',
  'lock.enterPin': 'Enter your PIN',
  'lock.lockoutTitle': 'Try again in {time}',
  'lock.lockoutBody':
    'Too many wrong PINs. Each further run of wrong attempts makes the pause longer.',
  'lock.wrongPin.one': 'Wrong PIN. {count} attempt left.',
  'lock.wrongPin.other': 'Wrong PIN. {count} attempts left.',
  'lock.biometricSubtitle': 'Use {biometry} or enter your PIN',
  'lock.biometricKey': 'Unlock with {biometry}',
  'lock.biometricKeyAndroid': 'Unlock with fingerprint or face',
  'lock.useDevicePasscode': 'Use device passcode',
  'lock.useScreenLock': 'Use screen lock',
  'lock.useBiometryOr': 'Use {biometry} or {fallback}',
  'lock.fallbackPasscode': 'passcode',
  'lock.fallbackScreenLock': 'screen lock',
  'lock.faceId': 'Face ID',
  'lock.touchId': 'Touch ID',
  'lock.biometricUnlock': 'biometric unlock',
  'lock.insecureDevice':
    'This device looks rooted or modified. Your vault still works, but be careful.',
} as const;
