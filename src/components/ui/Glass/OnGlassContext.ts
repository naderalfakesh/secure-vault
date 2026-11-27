import { createContext, useContext } from 'react';

// True inside a Liquid Glass surface so child inputs render opaque instead of letting glass bleed through.
export const OnGlassContext = createContext(false);

export function useOnGlass(): boolean {
  return useContext(OnGlassContext);
}
