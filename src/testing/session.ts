import { useSessionActions, useSessionState } from '@/features/session/SessionProvider';
import type { SessionActions, SessionState } from '@/features/session/SessionProvider';

/** The whole session in one object, for probes that read state and call actions. */
export type Session = SessionState & SessionActions;

export function useSessionValue(): Session {
  return { ...useSessionState(), ...useSessionActions() };
}
