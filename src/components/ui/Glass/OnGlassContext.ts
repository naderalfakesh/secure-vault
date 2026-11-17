import { createContext, useContext } from 'react';

/**
 * True inside a surface drawn with Liquid Glass (a sheet), so fields can sit
 * on a solid surface of their own instead of letting the glass tint through.
 */
export const OnGlassContext = createContext(false);

export function useOnGlass(): boolean {
  return useContext(OnGlassContext);
}
