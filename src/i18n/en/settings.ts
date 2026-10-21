/** Settings, Auto-lock and How your data is protected (handover §6 Settings, §7.6). */
export const settings = {
  'settings.title': 'Settings',
  'settings.group.security': 'Security',
  'settings.group.data': 'Data',
  'settings.group.appearance': 'Appearance',
  'settings.group.suggestions': 'Suggestions',
  'settings.group.about': 'About',
  'settings.group.danger': 'Danger zone',
  'settings.biometricUnlock': 'Biometric unlock',
  'settings.biometricUnlock.subtitle': 'Unlock without typing your PIN',
  'settings.openSettings': 'Open Settings',
  'settings.autoLock': 'Auto-lock',
  'settings.privacyCover': 'Privacy cover',
  'settings.privacyCover.subtitle': 'Hide the vault in the app switcher and block screenshots',
  'settings.confirmShare': 'Confirm before sharing',
  'settings.confirmShare.subtitle': 'Ask for {biometry} before a copy leaves the vault',
  'settings.changePin': 'Change PIN',
  'settings.lockNow': 'Lock now',
  'settings.backup': 'Backup',
  'settings.backup.subtitle': 'Create or restore an encrypted backup',
  'settings.appearance': 'Appearance',
  'settings.appearance.system': 'System',
  'settings.appearance.light': 'Light',
  'settings.appearance.dark': 'Dark',
  'settings.suggestions': 'Detail suggestions',
  'settings.suggestions.heuristic':
    'Text patterns read on this device. No on-device model is used yet.',
  'settings.suggestions.model': 'On-device model: {engine}',
  'settings.suggestions.checking': 'Checking',
  'settings.protection': 'How your data is protected',
  'settings.sourceCode': 'Source code',
  'settings.sourceCode.value': 'GitHub',
  'settings.version': 'Version',
  'settings.erase': 'Delete everything',
  'settings.erase.subtitle': 'Erase every document from this phone',
  'settings.erase.title': 'Delete everything?',
  'settings.erase.subjectAll': 'All documents',
  'settings.erase.subjectOne': 'The 1 document',
  'settings.erase.subjectMany': 'All {count} documents',
  'settings.erase.body':
    '{subject} and the vault index are erased from this phone. This can’t be undone. Backups you saved elsewhere aren’t affected.',
  'settings.erase.backupFirst': 'Create a backup first',
  'settings.erase.confirmBody':
    'Every document and the vault index are erased from this device. This cannot be undone.',
  'settings.erase.done': 'Vault emptied',
  'settings.erase.pinNotCleared':
    'Vault emptied, but the old PIN could not be removed. Set up the vault again now with a new PIN.',
  'settings.erase.failed': 'Could not clear the vault.',
  'settings.autoLock.immediately': 'Immediately',
  'settings.autoLock.never': 'Never',
  'settings.autoLock.seconds': '{count} seconds',
  'settings.autoLock.minutes.one': '{count} minute',
  'settings.autoLock.minutes.other': '{count} minutes',
  'settings.autoLock.after': 'After {duration}',
  'settings.autoLock.onLeave': 'As soon as you leave the app',
  'settings.autoLock.untilLocked': 'Stays open until you lock it',
  'settings.autoLock.afterBackground': 'After {duration} in the background',
  'settings.autoLock.header': 'Lock the vault',
  'settings.autoLock.footer':
    'Counted from when you leave SecureVault. The privacy cover hides the vault straight away either way.',
  'settings.autoLock.neverWarning': 'Anyone holding your unlocked phone can open the vault.',
  'settings.protection.does': 'What SecureVault does',
  'settings.protection.cant': 'What it can’t protect against',
  'settings.protection.fact.encrypted':
    'Documents are encrypted on this phone with AES-256-GCM before they’re saved. The search index is a separate encrypted database whose key is kept in the vault.',
  'settings.protection.fact.key':
    'The encryption key is created on this phone and kept by {keeper}. It is never put in a backup.',
  'settings.protection.fact.keeperIos': 'the iOS Keychain',
  'settings.protection.fact.keeperAndroid': 'the Android Keystore',
  'settings.protection.fact.pin':
    'Your PIN is stored only as a salted hash, never as the PIN itself.',
  'settings.protection.fact.backup':
    'Backups are encrypted with a key made from your passphrase. SecureVault doesn’t keep the passphrase.',
  'settings.protection.fact.account':
    'There is no account, and SecureVault itself collects no analytics.',
  /** Google ML Kit disclosure (owner decision: ML Kit stays). Kept in step with docs/SECURITY.md. */
  'settings.protection.fact.mlkit':
    'SecureVault uses Google ML Kit to read document text on this phone. On Android, it also uses the Google Play services document scanner. ML Kit sends Google usage and performance metrics, which include an ID for this install. It doesn’t send your images or the text it reads. This can’t be turned off.',
  'settings.protection.limit.pin':
    'Someone who knows your PIN, or holds your phone while the vault is unlocked.',
  'settings.protection.limit.share':
    'Copies you share. Once a file leaves the vault, the receiving app controls it.',
  'settings.protection.limit.passphrase':
    'A lost backup passphrase. Nobody can recover it, including us.',
  'settings.protection.limit.tampered':
    'A phone that is jailbroken or rooted, or whose operating system has been tampered with.',
  'settings.protection.limit.cache':
    'Short-lived decrypted copies in the app’s cache while you view, add or share a document. SecureVault removes them when the vault locks.',
} as const;
