import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/** Android's back button does nothing while the calling screen is mounted. */
export function useBlockHardwareBack(): void {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);
}
