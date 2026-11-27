import { useRef } from 'react';
import type { AccessibilityActionEvent } from 'react-native';

import { ACTIVATION_ECHO_MS } from './constants';

// Screen readers can fire both accessibilityAction and onPress; drop the trailing echo.
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
