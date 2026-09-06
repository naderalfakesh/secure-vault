import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

export interface SecurityCheckResult {
  rooted: boolean;
  tampered: boolean;
  indicators: string[];
  integrityIssues: string[];
}

const EXPECTED_ANDROID_PACKAGE = 'com.naderalfakesh.securevault';
const EXPECTED_IOS_BUNDLE = 'com.naderalfakesh.securevault';

const ANDROID_ROOT_PATHS = [
  '/system/app/Superuser.apk',
  '/sbin/su',
  '/system/bin/su',
  '/system/xbin/su',
  '/system/sd/xbin/su',
  '/system/bin/failsafe/su',
  '/data/local/xbin/su',
  '/data/local/bin/su',
];

const IOS_JAILBREAK_PATHS = [
  '/Applications/Cydia.app',
  '/Library/MobileSubstrate/MobileSubstrate.dylib',
  '/bin/bash',
  '/usr/sbin/sshd',
  '/etc/apt',
  '/private/var/lib/apt/',
];

function pathExists(path: string): boolean {
  try {
    return new File(path).exists;
  } catch {
    return false;
  }
}

/**
 * Best-effort device integrity signals. The result is advisory: callers show a
 * warning and never block the vault, so development builds and unusual devices
 * stay usable.
 */
export async function detectDeviceCompromise(): Promise<SecurityCheckResult> {
  const indicators: string[] = [];

  // Simulators and emulators expose host paths such as /bin/bash, so the
  // artifact scan only means something on a physical device.
  if (Device.isDevice) {
    const pathsToCheck = Platform.OS === 'android' ? ANDROID_ROOT_PATHS : IOS_JAILBREAK_PATHS;
    for (const path of pathsToCheck) {
      if (pathExists(path)) {
        indicators.push(`Detected artifact: ${path}`);
      }
    }
  }

  const tamperIssues: string[] = [];
  const currentPackage =
    Platform.OS === 'android'
      ? Constants?.expoConfig?.android?.package
      : Constants?.expoConfig?.ios?.bundleIdentifier;

  if (currentPackage && Platform.OS === 'android' && currentPackage !== EXPECTED_ANDROID_PACKAGE) {
    tamperIssues.push(`Unexpected Android package: ${currentPackage}`);
  }

  if (currentPackage && Platform.OS === 'ios' && currentPackage !== EXPECTED_IOS_BUNDLE) {
    tamperIssues.push(`Unexpected iOS bundle ID: ${currentPackage}`);
  }

  return {
    rooted: indicators.length > 0,
    tampered: tamperIssues.length > 0,
    indicators,
    integrityIssues: tamperIssues,
  };
}
