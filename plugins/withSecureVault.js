const {
  withPlugins,
  withInfoPlist,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withSecureVault = (config) => {
  return withPlugins(config, [
    // iOS
    (config) => {
      return withInfoPlist(config, (config) => {
        config.modResults.NSFaceIDUsageDescription =
          'SecureVault uses Face ID to unlock your documents.';
        return config;
      });
    },
    // Android
    (config) => {
      return withAndroidManifest(config, (config) => {
        config.modResults.manifest['uses-permission'] = [
          ...(config.modResults.manifest['uses-permission'] || []),
          { $: { 'android:name': 'android.permission.USE_BIOMETRIC' } },
        ];
        return config;
      });
    },
    (config) => {
      return withDangerousMod(config, [
        'android',
        async (config) => {
          const proguardRulesPath = path.join(
            config.modRequest.platformProjectRoot,
            'app',
            'proguard-rules.pro',
          );
          const proguardRules = `
-keep class expo.modules.vault.** { *; }
`;
          await fs.promises.appendFile(proguardRulesPath, proguardRules);
          return config;
        },
      ]);
    },
  ]);
};

module.exports = withSecureVault;
