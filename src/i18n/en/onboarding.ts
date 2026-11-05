/** First run: intro, Choose PIN, biometrics step. */
export const onboarding = {
  'onboarding.intro.1.title': 'One place for the papers that matter',
  'onboarding.intro.1.body':
    'Passports, IDs, insurance cards, leases, receipts. Scan them once and find them in seconds.',
  'onboarding.intro.2.title': 'Encrypted on this phone',
  'onboarding.intro.2.bodyIos':
    'Every page is encrypted before it’s saved. The key is created on this phone and kept by the iOS Keychain. There’s no account to sign up for.',
  'onboarding.intro.2.bodyAndroid':
    'Every page is encrypted before it’s saved. The key is created on this phone and kept by the Android Keystore. There’s no account to sign up for.',
  'onboarding.intro.3.title': 'Unlock the way you already do',
  'onboarding.intro.3.rest':
    'A 6-digit PIN is always there as a backup, and the vault locks itself when you leave.',
  'onboarding.intro.3.screenLock': 'Your screen lock opens the vault. {rest}',
  'onboarding.intro.3.fingerprintOrFace': 'Your fingerprint or face opens the vault. {rest}',
  'onboarding.intro.3.faceId': 'Face ID opens the vault. {rest}',
  'onboarding.intro.3.touchId': 'Touch ID opens the vault. {rest}',
  'onboarding.intro.3.faceOrTouchId': 'Face ID or Touch ID opens the vault. {rest}',
  'onboarding.intro.3.passcode': 'Your device passcode opens the vault. {rest}',
  'onboarding.intro.skip': 'Skip',
  'onboarding.intro.setUp': 'Set up your vault',
  'onboarding.intro.step': 'Step {step} of {total}',
  'onboarding.pin.chooseTitle': 'Choose a 6-digit PIN',
  'onboarding.pin.addTitle': 'Add a PIN to your vault',
  'onboarding.pin.confirmTitle': 'Enter it again',
  'onboarding.pin.savingPin': 'Saving your PIN',
  'onboarding.pin.creatingKey': 'Creating your vault key',
  'onboarding.pin.confirmHint': 'Same PIN, once more.',
  'onboarding.pin.addHint': 'Your documents stay where they are. The PIN is a second way in.',
  'onboarding.pin.emptyVaultHint':
    'Your vault is empty. The PIN is your fallback when biometrics are unavailable.',
  'onboarding.pin.hintPasscode': 'You’ll use it with your device passcode to open the vault.',
  'onboarding.pin.hintScreenLock': 'You’ll use it with your screen lock to open the vault.',
  'onboarding.pin.hintAndroid':
    'Your backup way in when fingerprint or face unlock isn’t available.',
  'onboarding.pin.hintBiometry': 'Your backup way in when {biometry} isn’t available.',
  'onboarding.pin.mismatch': 'The PINs didn’t match. Start again.',
  'onboarding.pin.easy': 'This PIN is easy to guess.',
  'onboarding.pin.useAnyway': 'Use it anyway',
  'onboarding.pin.chooseAnother': 'Choose another',
  'onboarding.pin.step1': 'Step 1 of 2',
  'onboarding.pin.step2': 'Step 2 of 2',
  'onboarding.biometrics.rest': 'Your PIN still works, and you can change this in Settings.',
  'onboarding.biometrics.titleAndroid': 'Unlock with fingerprint or face?',
  'onboarding.biometrics.bodyAndroid': 'Open the vault without typing your PIN. {rest}',
  'onboarding.biometrics.actionAndroid': 'Use fingerprint or face',
  'onboarding.biometrics.title': 'Unlock with {biometry}?',
  'onboarding.biometrics.bodyTouch': 'Open the vault with a touch. {rest}',
  'onboarding.biometrics.bodyGlance': 'Open the vault with a glance. {rest}',
  'onboarding.biometrics.action': 'Use {biometry}',
  'onboarding.biometrics.prompt': 'Unlock SecureVault',
  'onboarding.biometrics.notNow': 'Not now',
  'onboarding.biometrics.notEnrolledIos':
    '{biometry} isn’t set up on this phone. Set it up in the Settings app, then come back.',
  'onboarding.biometrics.notEnrolledAndroid':
    'Fingerprint or face unlock isn’t set up on this phone.',
  'onboarding.biometrics.noPasscodeIos':
    'This phone has no passcode. Set a passcode and {biometry} in the Settings app, then come back.',
  'onboarding.biometrics.noPasscodeAndroid':
    'This phone has no screen lock. Set one up with fingerprint or face unlock, then come back.',
  'onboarding.biometrics.denied':
    'SecureVault isn’t allowed to use {biometry}. You can allow it in Settings.',
} as const;
