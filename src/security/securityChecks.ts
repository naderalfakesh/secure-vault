import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

export interface SecurityCheckResult {
  rooted: boolean;
  tampered: boolean;
  indicators: string[];
  integrityIssues: string[];
}

const EXPECTED_ANDROID_PACKAGE = 'com.nader.alfakesh.securevault';
const EXPECTED_IOS_BUNDLE = 'com.nader.alfakesh.securevault';

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

async function pathExists(path: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
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

  const pathsToCheck = Platform.OS === 'android' ? ANDROID_ROOT_PATHS : IOS_JAILBREAK_PATHS;
  for (const path of pathsToCheck) {
    // Checking for well-known root/jailbreak artifacts
    if (await pathExists(path)) {
      indicators.push(`Detected artifact: ${path}`);
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
