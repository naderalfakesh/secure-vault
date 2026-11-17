import { useRef } from 'react';
import type { AccessibilityActionEvent } from 'react-native';

import { ACTIVATION_ECHO_MS } from './constants';

/**
 * Press and accessibility-action handlers for a switch row. A screen
 * reader's activation may arrive both as the action and as a press, so a
 * press right after an action is dropped.
 */
export function useSwitchActivation(flip: () => void) {
  const lastActivation = useRef(0);
  return {
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName !== 'activate') return;
      lastActivation.current = Date.now();
      flip();
    },
    onPress: () => {
      if (Date.now() - lastActivation.current < ACTIVATION_ECHO_MS) return;
      flip();
    },
  };
}
