import { errorCode } from '@/utils/errors';

/** The picker refused because another pick is still closing. */
export function pickerBusy(error: unknown): boolean {
  const { message } = (error ?? {}) as { message?: unknown };
  return (
    errorCode(error) === 'ERR_PICKING_IN_PROGRESS' ||
    (typeof message === 'string' && /picking in progress/i.test(message))
  );
}
