import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { versionLabel } from './helpers';

/** "1.0.0 (12)": the app version, with the build number when the binary has one. */
export function appVersion(): string {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = Platform.select({
    ios: Constants.expoConfig?.ios?.buildNumber,
    android: Constants.expoConfig?.android?.versionCode?.toString(),
  });
  return versionLabel(version, build);
}
