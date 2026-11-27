import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

interface SecurityCheckResult {
  rooted: boolean;
  tampered: boolean;
  indicators: string[];
  integrityIssues: string[];
}

const EXPECTED_BUNDLE_ID = 'com.naderalfakesh.securevault';

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

export async function detectDeviceCompromise(): Promise<SecurityCheckResult> {
  const indicators: string[] = [];

  // Simulators/emulators expose host paths like /bin/bash, so only scan physical devices.
  if (Device.isDevice) {
    const pathsToCheck = Platform.OS === 'android' ? ANDROID_ROOT_PATHS : IOS_JAILBREAK_PATHS;
    for (const path of pathsToCheck) {
      if (pathExists(path)) {
        // i18n-ignore: diagnostic detail, never shown on screen
        indicators.push(`Detected artifact: ${path}`);
      }
    }
  }

  const tamperIssues: string[] = [];
  const currentPackage =
    Platform.OS === 'android'
      ? Constants?.expoConfig?.android?.package
      : Constants?.expoConfig?.ios?.bundleIdentifier;

  const onDevice = Platform.OS === 'android' || Platform.OS === 'ios';
  if (onDevice && currentPackage && currentPackage !== EXPECTED_BUNDLE_ID) {
    // i18n-ignore: diagnostic detail, never shown on screen
    tamperIssues.push(`Unexpected app identifier: ${currentPackage}`);
  }

  return {
    rooted: indicators.length > 0,
    tampered: tamperIssues.length > 0,
    indicators,
    integrityIssues: tamperIssues,
  };
}
