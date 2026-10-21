/** Failure sentences that reach the screen through an error's message. */
export const errors = {
  'errors.keyLocked': 'The device key was not unlocked, so your documents stay closed. Try again.',
  'errors.keyInvalidated':
    "This device's screen lock or biometrics changed, so the vault key can no longer be used. The documents already in this vault cannot be opened on this device.",
  'errors.index.keyInvalidated':
    'The device key can no longer be used, so the document index cannot be opened.',
  'errors.index.keyUnreadable':
    'The document index key could not be read. Nothing was changed. Try again.',
  'errors.index.filesUnreadable':
    "The vault's files could not be read, so the document index stays closed. Nothing was changed. Try again.",
  'errors.index.keyMissing':
    'The key for the document index is missing, so the index cannot be opened. Nothing was changed.',
  'errors.index.nameUnreadable':
    'The document index could not be found, so it stays closed. Nothing was changed. Try again.',
  'errors.index.erasing':
    'The vault is being emptied, so the document index stays closed. Try again in a moment.',
  'errors.index.emptied':
    'The vault was emptied, so the document index stays closed until it is set up again.',
  'errors.erase.indexOpen':
    '"Delete everything" did not finish because the document index is still open, so nothing was deleted. Close SecureVault completely, open it again, and try again.',
  'errors.erase.incomplete':
    '"Delete everything" did not finish, so part of the vault is still on this device. Try it again.',
  'errors.boundary.title': 'Something went wrong',
  'errors.boundary.body':
    'Your documents are still encrypted and safe. Try again, or relaunch the app.',
} as const;
