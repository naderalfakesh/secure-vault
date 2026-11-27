import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useScreenCaptureBlock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [enabled]);
}
