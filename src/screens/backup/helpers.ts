/** The picker refused because another pick is still closing. */
export function pickerBusy(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return (
    code === 'ERR_PICKING_IN_PROGRESS' ||
    (typeof message === 'string' && /picking in progress/i.test(message))
  );
}

/** The `code` a native module put on an error, if any. */
export function errorCode(error: unknown): unknown {
  return (error as { code?: unknown } | null)?.code;
}
