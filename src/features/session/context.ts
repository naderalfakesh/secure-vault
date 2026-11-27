import { createContext, useContext } from 'react';

import type { SessionActions, SessionState } from './types';

export const SessionStateContext = createContext<SessionState | null>(null);
export const SessionActionsContext = createContext<SessionActions | null>(null);

export function useSessionState(): SessionState {
  const context = useContext(SessionStateContext);
  if (!context) {
    throw new Error('useSessionState must be used inside SessionProvider');
  }
  return context;
}

export function useSessionActions(): SessionActions {
  const context = useContext(SessionActionsContext);
  if (!context) {
    throw new Error('useSessionActions must be used inside SessionProvider');
  }
  return context;
}
