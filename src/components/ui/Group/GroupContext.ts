import { createContext, useContext } from 'react';

/** Rows inside a Group leave the separators to it. */
export const GroupContext = createContext(false);

export function useInGroup(): boolean {
  return useContext(GroupContext);
}
