import { createContext, useContext } from 'react';

import type { SessionActions, SessionState } from './types';

export const SessionStateContext = createContext<SessionState | null>(null);
export const SessionActionsContext = createContext<SessionActions | null>(null);

/** The session's state; a component that reads it renders again on every change. */
export function useSessionState(): SessionState {
  const context = useContext(SessionStateContext);
  if (!context) {
    throw new Error('useSessionState must be used inside SessionProvider');
  }
  return context;
}

/** The session's functions; the object never changes, so reading it never renders again. */
export function useSessionActions(): SessionActions {
  const context = useContext(SessionActionsContext);
  if (!context) {
    throw new Error('useSessionActions must be used inside SessionProvider');
  }
  return context;
}
