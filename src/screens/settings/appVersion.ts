import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { versionLabel } from './helpers';

export function appVersion(): string {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = Platform.select({
    ios: Constants.expoConfig?.ios?.buildNumber,
    android: Constants.expoConfig?.android?.versionCode?.toString(),
  });
  return versionLabel(version, build);
}
