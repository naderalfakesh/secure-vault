import { useEffect, useSyncExternalStore } from 'react';

// Screens that take over the bottom of the screen (Library's multi-select
// actions) hide the floating tab bar while they do.
let hidden = false;
const listeners = new Set<() => void>();

function setHidden(next: boolean) {
  if (hidden === next) return;
  hidden = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const read = () => hidden;

export function useTabBarHidden(): boolean {
  return useSyncExternalStore(subscribe, read, read);
}

/** Hides the tab bar while `hide` is true and the calling screen is mounted. */
export function useHideTabBar(hide: boolean): void {
  useEffect(() => {
    setHidden(hide);
    return () => setHidden(false);
  }, [hide]);
}
