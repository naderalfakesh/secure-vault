/** Time away a pause excuses by default: pickers, the camera, the scanner. */
export const DEFAULT_PAUSE_MAX_AWAY_MS = 10 * 60_000;
/** How long after the return an `endsOnReturn` pause may still settle on its own. */
export const AUTO_LOCK_RETURN_GRACE_MS = 1000;
/** Time away a share sheet's pause excuses (`sharePause`). */
export const SHARE_PAUSE_MAX_AWAY_MS = 2 * 60_000;

// A tiny vault entry whose read proves the device key is currently usable.
export const KEY_PROBE_ENTRY = '_key_probe';
