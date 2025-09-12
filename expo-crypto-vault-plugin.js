const { withPlugins, withInfoPlist, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withExpoCryptoVault = (config) => {
  return withPlugins(config, [
    // iOS
    (config) => {
      return withInfoPlist(config, (config) => {
        config.modResults.NSFaceIDUsageDescription = 'This app uses Face ID to secure your notes.';
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
                const proguardRulesPath = path.join(config.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
                const proguardRules = `
-keep class expo.modules.vault.** { *; }
`;
                await fs.promises.appendFile(proguardRulesPath, proguardRules);
                return config;
            },
        ]);
    }
  ]);
};

module.exports = withExpoCryptoVault;