import { createContext, useContext } from 'react';

export const GroupContext = createContext(false);

export function useInGroup(): boolean {
  return useContext(GroupContext);
}
