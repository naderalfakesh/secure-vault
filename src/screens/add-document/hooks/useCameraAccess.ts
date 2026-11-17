import * as ImagePicker from 'expo-image-picker';
import { type RefObject, useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Camera access: whether the callout shows, and the request before the camera opens. */
export function useCameraAccess(cameraAvailable: boolean, mountedRef: RefObject<boolean>) {
  const [cameraDenied, setCameraDenied] = useState(false);

  // Camera access refused earlier (or in Settings) shows the callout straight
  // away; coming back from Settings with access on hides it again.
  useEffect(() => {
    if (!cameraAvailable) return;
    let active = true;
    const check = () => {
      ImagePicker.getCameraPermissionsAsync()
        .then((permission) => {
          if (!active) return;
          if (permission.granted) setCameraDenied(false);
          else if (!permission.canAskAgain) setCameraDenied(true);
        })
        .catch(() => {});
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [cameraAvailable]);

  /** iOS's scanner and the camera picker need camera access; a refusal shows the callout. */
  const cameraAllowed = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (mountedRef.current) setCameraDenied(true);
      return false;
    }
    return true;
  }, [mountedRef]);

  return { cameraDenied, cameraAllowed };
}
