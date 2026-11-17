// The session's settings: the model, its copy, and the secure-store records
// it shares with the PIN and the lockout. Each lives in its own module; this
// one keeps the public import path.
export {
  AUTO_LOCK_OPTIONS,
  type AutoLockSeconds,
  DEFAULT_SETTINGS,
  sanitizeSettings,
  type SecuritySettings,
} from './securitySettings';
export { autoLockChoice, autoLockDescription, autoLockLabel } from './autoLockCopy';
export { SESSION_MARKER_DIRECTORY } from './storage/markers';
export { sessionStorage, type StoredRead } from './storage/sessionStorage';
